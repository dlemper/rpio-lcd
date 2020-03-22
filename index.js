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
			dataPins[RS, b4, b5, b6, b7]
			dataIO: rpio / ShiftRegister
			clockPin: CLK
			clockIO: rpio / ShiftRegister
			largeFont: true/false
			rows: 1-4
			columns: 8-20
		}
		*/
		this.dataPins = [
			options.pins[0],
			options.pins[1],
			options.pins[2],
			options.pins[3],
			options.pins[4]
		];

		this.dataIO = options.dataIO || rpio;
		this.clockPin = options.clockPin;
		this.clockIO = options.clockIO || rpio;
		this.lastRegisterSelect = false;

		const functionSetFLAGS = 0;
		if (this.numRows > 1) {
			functionSetFLAGS |= MULTIPLE_LINES;
		}
		if (this.numRows === 1 && !!options.largeFont) {
			functionSetFLAGS |= LARGE_FONT;
		}

		for (let i = 0; i < 5; i += 1){
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
		if (this.dataIO.isShiftRegister){
			let pinsToChange = [];
			pinsToChange[this.dataPins[1]] = ((nib & 0b0001) > 0) | 0;
			pinsToChange[this.dataPins[2]] = ((nib & 0b0010) > 0) | 0;
			pinsToChange[this.dataPins[3]] = ((nib & 0b0100) > 0) | 0;
			pinsToChange[this.dataPins[4]] = ((nib & 0b1000) > 0) | 0;
			this.dataIO.writeByte(pinsToChange);
			this.pulse();
		} else {
			this.dataIO.write(this.dataPins[1], ((nib & 0b0001) > 0) | 0);
			this.dataIO.write(this.dataPins[2], ((nib & 0b0010) > 0) | 0);
			this.dataIO.write(this.dataPins[3], ((nib & 0b0100) > 0) | 0);
			this.dataIO.write(this.dataPins[4], ((nib & 0b1000) > 0) | 0);
			this.pulse();
		}
	}

	sendByte(byte) {
		this.sendNibble(byte >> 4);
		this.sendNibble(byte & 0b1111);
	}

	clear() {
		this.registerSelect(false);
		this.sendByte(COMMANDS.CLEAR_DISPLAY);
		rpio.msleep(2); // Screen needs 1.52 ms to clear display
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
		this.cursorHome();

		for (let i = 0; i < 40; i += 1){
			this.sendByte(0b00010100);
		}
	}

	textLeft() {
		this.registerSelect(false);
		this.sendByte(0b00011000);
	}

	textRight() {
		this.registerSelect(false);
		this.sendByte(0b00011100);
	}

	setCustomChar(location, bytes) {
		location &= 0x7; // we only have 8 locations 0-7
		this.registerSelect(false);
		this.sendByte(0b01000000 | location << 3); // Set to "Write CGRAM" mode
		this.registerSelect(true);

		for (let i = 0; i < 8; i += 1){
			this.sendByte(bytes[i]);
		}

		this.registerSelect(false);
		screen.sendByte(0b10000000); // Set to normal text mode
	}

	writeText(bytes) {
		this.registerSelect(true);

		if (!(bytes instanceof Uint8Array)){
			bytes = Buffer.from(bytes, "ascii");
		}

		for (let i = 0; i < bytes.length; i += 1){
			this.sendByte(bytes[i]);
			rpio.msleep()
		}
	}

	writeMode(goRight, moveScreen) {
		this.registerSelect(false);
		this.sendByte(COMMANDS.ENTRY_MODE_SET | (goRight ? FLAGS.LEFT_TO_RIGHT : 0) | (moveScreen | 0));
	}
}

module.exports = LCDScreen;