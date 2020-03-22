const rpio = require("rpio");

const COMMANDS = {
	CLEAR_DISPLAY: 0x01,
	RETURN_HOME: 0x02,
	ENTRY_MODE_SET: 0x04,
	DISPLAY_CONTROL: 0x08,
	CURSOR_OR_DISPLAY_SHIFT: 0x10,
	FUNCTION_SET: 0x20,
	SET_CGRAM_ADDRESS: 0x40,
	SET_CURSOR: 0x80,
};

const FLAGS = {
	// entry mode set
	AUTOSCROLL_ON: 0x01,
	LEFT_TO_RIGHT: 0x02,

	// display control
	BLINK_ON: 0x01,
	CURSOR_ON: 0x02,
	DISPLAY_ON: 0x04,

	// cursor or display shift
	SHIFT_RIGHT: 0x04,
	DISPLAY_SHIFT: 0x08,

	// function set
	EIGHT_BIT_MODE: 0x01,
	LARGE_FONT: 0x04,
	MULTIPLE_LINES: 0x08,
}

class LCDScreen {
	constructor(options) {
		/*
		{
			pins[RS, b4, b5, b6, b7]
			dataIO: rpio / ShiftRegister
			clockPin: CLK
			clockIO: rpio / ShiftRegister
			largeFont: true/false (only possible on single row displays that support 5x10 font)
			rows: 1-4 (default: 2)
			columns: 8-20 (default: 16)
		}
		*/
		this.dataPins = [
			options.pins[0],
			options.pins[1],
			options.pins[2],
			options.pins[3],
			options.pins[4],
		];

		this.cols = options.columns || 16;
		this.rows = options.rows || 2;

		this.dataIO = options.dataIO || rpio;
		this.clockPin = options.clockPin;
		this.clockIO = options.clockIO || rpio;
		this.lastRegisterSelect = false;
		this.rowOffsets = [0x00, 0x40, 0x00 + this.cols, 0x40 + this.cols];

		let functionSetFLAGS = 0;
		if (this.rows > 1) {
			functionSetFLAGS |= FLAGS.MULTIPLE_LINES;
		}
		if (this.rows === 1 && !!options.largeFont) {
			functionSetFLAGS |= FLAGS.LARGE_FONT;
		}

		for (let i = 0; i < 5; i++){
			this.dataIO.open(this.dataPins[i], rpio.OUTPUT, rpio.LOW);
		}

		this.clockIO.open(this.clockPin, rpio.OUTPUT, rpio.LOW);

		// Reset the LCD screen to 8 bit mode
		this.sendNibble(COMMANDS.FUNCTION_SET | FLAGS.EIGHT_BIT_MODE);
		this.pulse(); // Yes, there are supposed to be 3.
		this.pulse();
		this.pulse();

		// Set the LCD screen to 4 bit mode
		this.sendNibble(COMMANDS.FUNCTION_SET);
		this.pulse();
		this.sendByte(COMMANDS.FUNCTION_SET | functionSetFLAGS);
		this.cursorConfig = FLAGS.DISPLAY_ON | FLAGS.BLINK_ON;
		this.sendByte(COMMANDS.DISPLAY_CONTROL | this.cursorConfig); // Enable display with blinking cursor
		this.clear();
		this.sendByte(COMMANDS.ENTRY_MODE_SET | FLAGS.LEFT_TO_RIGHT); // When text is sent, cursor moves to the right, display doesn't move
		this.sendByte(COMMANDS.SET_CURSOR); // Make sure we're in DDRAM mode
	}

	displayOn(showText) {
		if (showText) {
			this.cursorConfig |= FLAGS.DISPLAY_ON;
		} else {
			this.cursorConfig &= ~FLAGS.DISPLAY_ON;
		}

		this.registerSelect(false);
		this.sendByte(COMMANDS.DISPLAY_CONTROL | this.cursorConfig);
	}

	cursorBlink(blink) {
		if (blink) {
			this.cursorConfig |= FLAGS.BLINK_ON;
		} else {
			this.cursorConfig &= ~FLAGS.BLINK_ON;
		}

		this.registerSelect(false);
		this.sendByte(COMMANDS.DISPLAY_CONTROL | this.cursorConfig);
	}

	cursorUnderscore(underscore) {
		if (underscore) {
			this.cursorConfig |= FLAGS.CURSOR_ON;
		} else {
			this.cursorConfig &= ~FLAGS.CURSOR_ON;
		}

		this.registerSelect(false);
		this.sendByte(COMMANDS.DISPLAY_CONTROL | this.cursorConfig);
	}

	registerSelect(sendData) {
		if (sendData != this.lastRegisterSelect){
			this.lastRegisterSelect = Boolean(sendData);
			this.dataIO.write(this.dataPins[0], this.lastRegisterSelect ? rpio.HIGH : rpio.LOW);
		}
	}

	pulse() {
		this.clockIO.write(this.clockPin, rpio.HIGH);
		this.clockIO.write(this.clockPin, rpio.LOW);
		rpio.usleep(40);
	}

	sendNibble(nib) {
		if (this.dataIO.isShiftRegister) {
			const pinsToChange = this.dataPins
				.slice(1)
				.map((pin, idx) => [pin, (nib >> idx) & 1]);
	
			this.dataIO.writeByte(Object.fromEntries(pinsToChange));
		} else {
			this.dataPins
				.slice(1)
				.forEach((pin, idx) => this.dataIO.write(pin, (nib >> idx) & 1));
		}
			
		this.pulse();
	}

	sendByte(byte) {
		this.sendNibble(byte >> 4);
		this.sendNibble(byte & 0x0f);
	}

	clear() {
		this.registerSelect(false);
		this.sendByte(COMMANDS.CLEAR_DISPLAY);
		rpio.msleep(2); // Screen needs 1.52 ms to clear display
	}

	setCursor(col, row) {
    const pos = col + this.rowOffsets[row % this.rows];
    
		this.sendByte(COMMANDS.SET_CURSOR | pos);
  }

	cursorLeft() {
		this.registerSelect(false);
		this.sendByte(COMMANDS.CURSOR_OR_DISPLAY_SHIFT);
	}

	cursorRight() {
		this.registerSelect(false);
		this.sendByte(COMMANDS.CURSOR_OR_DISPLAY_SHIFT | FLAGS.SHIFT_RIGHT);
	}

	cursorHome() {
		this.registerSelect(false);
		this.sendByte(COMMANDS.RETURN_HOME);
		rpio.msleep(2);
	}

	cursorSecondLine() {
		this.setCursor(0, 1);
	}

	textLeft() {
		this.registerSelect(false);
		this.sendByte(COMMANDS.CURSOR_OR_DISPLAY_SHIFT | FLAGS.DISPLAY_SHIFT);
	}

	textRight() {
		this.registerSelect(false);
		this.sendByte(COMMANDS.CURSOR_OR_DISPLAY_SHIFT | FLAGS.DISPLAY_SHIFT | FLAGS.SHIFT_RIGHT);
	}

	setCustomChar(location, bytes) {
		location &= 0x07; // we only have 8 locations 0-7
		this.registerSelect(false);
		this.sendByte(COMMANDS.SET_CGRAM_ADDRESS | location << 3); // Set to "Write CGRAM" mode
		this.registerSelect(true);

		for (let i = 0; i < 8; i++) {
			this.sendByte(bytes[i]);
		}

		this.registerSelect(false);
		screen.sendByte(COMMANDS.SET_CURSOR); // Set to normal text mode
	}

	writeText(bytes) {
		this.registerSelect(true);

		if (!(bytes instanceof Uint8Array)) {
			bytes = Buffer.from(bytes, "ascii");
		}

		for (let i = 0; i < bytes.length; i++) {
			this.sendByte(bytes[i]);
			rpio.msleep();
		}
	}

	writeMode(goRight, moveScreen) {
		this.registerSelect(false);
		this.sendByte(COMMANDS.ENTRY_MODE_SET | (goRight ? FLAGS.LEFT_TO_RIGHT : 0) | (moveScreen | 0));
	}
}

module.exports = LCDScreen;