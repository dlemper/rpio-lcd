const rpio = require("rpio");
class LCDScreen {
	constructor(options) {
		/*
		{
			dataPins[RS, b4, b5, b6, b7]
			dataIO: rpio / ShiftRegister
			clockPin: CLK
			clockIO: rpio / ShiftRegister
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
		for (let i = 0; i < 5; i += 1){
			this.dataIO.open(this.dataPins[i], rpio.OUTPUT, rpio.LOW);
		}
		this.clockIO.open(this.clockPin, rpio.OUTPUT, rpio.LOW);

		// Reset the LCD screen to 8 bit mode
		this.dataIO.write(this.dataPins[1], rpio.HIGH);
		this.dataIO.write(this.dataPins[2], rpio.HIGH);
		this.pulse(); // Yes, there are supposed to be 3.
		this.pulse();
		this.pulse();

		// Set the LCD screen to 4 bit mode
		this.dataIO.write(this.dataPins[1], rpio.LOW);
		this.pulse();
		this.sendByte(0b00101000); // 4 bit mode, 2 lines (tested with an 16x2 screen), 5x8 font
		this.sendByte(0b00001101); // Enable display with blinking cursor
		this.cursorConfig = 0b101;
		this.sendByte(0b00000001); // Clear Display
		rpio.msleep(2); // Screen needs 1.52 ms to clear display
		this.sendByte(0b00000110); // When text is sent, cursor moves to the right, display doesn't move
		this.sendByte(0b10000000); // Make sure we're in DDRAM mode 
	}
	displayOn(showText) {
		if (showText) {
			this.cursorConfig |= 0b100;
		}else{
			this.cursorConfig &= 0b011;
		}
		this.registerSelect(false);
		this.sendByte(0b00001000 | this.cursorConfig);
	}
	cursorBlink(blink) {
		if (blink) {
			this.cursorConfig |= 0b001;
		}else{
			this.cursorConfig &= 0b110;
		}
		this.registerSelect(false);
		this.sendByte(0b00001000 | this.cursorConfig);
	}
	cursorUnderscore(underscore) {
		if (underscore) {
			this.cursorConfig |= 0b010;
		}else{
			this.cursorConfig &= 0b101;
		}
		this.registerSelect(false);
		this.sendByte(0b00001000 | this.cursorConfig);
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
			
		}else{
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
	clear(){
		this.registerSelect(false);
		this.sendByte(0b00000001);
		rpio.msleep(2);
	}
	cursorLeft() {
		this.registerSelect(false);
		this.sendByte(0b00010000);
	}
	cursorRight() {
		this.registerSelect(false);
		this.sendByte(0b00010100);
	}
	cursorHome() {
		this.registerSelect(false);
		this.sendByte(0b00000010);
		rpio.msleep(2);
	}
	cursorSecondLine() {
		this.registerSelect(false);
		this.sendByte(0b00000010);
		rpio.msleep(2);
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
		this.sendByte(0b00000100 | (goRight ? 0b10 : 0) | (moveScreen | 0));
	}
}
module.exports = {LCDScreen};