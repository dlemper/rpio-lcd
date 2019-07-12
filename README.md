# rpio-lcd
Control character LCDs with your Pi using JavaScript!

This library has only been tested on 16x2 displays, but it should work for others.

## A note on the LCD Character set:

The character set of the Hitachi HD44780UA00 (The most used character LCD screen controller) is _mostly_ ascii but with some minor differences.

* If you send it a backslash, ("\\\\") it will display a yen symbol (¥)
* If you send it a tilde, ("~") it will display a left-arrow (←)
* If you send it a DEL character, ("\\x7f") it will display a right-arrow (→)

The characters beyond 0x7f include japanese katakana, some greek letters, and mathematical symbols. [Check this out for more info!](https://mil.ufl.edu/3744/docs/lcdmanual/characterset.html)

```js
const rpio = require("rpio");
const {LCDScreen} = require("rpio-lcd");

// Initialize an LCD screen!
const screen = new LCDScreen({
	// pins: [registerSelect, d4, d5, d6, d7]
	pins: [11, 13, 15, 16, 18],
	// This is optional, you can specify a ShiftRegister from "rpio-shift" here if the above pins are connected to one
	dataIO: null,

	// This is the enable pin on the LCD
	clockPin: 12,
	// This is optional, you can specify a ShiftRegister from "rpio-shift" here if the above pin is connected to one
	clockIO: null
})

// screen.displayOn(bool)
// If true, the display is shown. You can still write or send commands to the LCD while the screen is hidden
// This is enabled by default
screen.displayOn(true);

// screen.cursorBlink(bool)
// If true, the cursor will blink
// This is enabled by default
screen.cursorBlink(true);

// screen.cursorUnderscore(bool)
// If true, an underscore will be shown at the cursor position
// This is disabled by default
screen.cursorUnderscore(false);

// screen.clear()
// Clears the screen and returns the cursor to the home position
screen.clear();

// screen.cursorLeft()
// Moves the cursor one space to the left
screen.cursorLeft();

// screen.cursorLeft()
// Moves the cursor one space to the right
screen.cursorRight();

// screen.cursorHome()
// Moves the cursor to the beginning of the first line
screen.cursorHome();

// screen.cursorSecondLine()
// Moves the cursor to the beginning of the second line
screen.cursorSecondLine();

// screen.textLeft()
// Moves the text on screen to the left
screen.textLeft();

// screen.textRight()
// Moves the text on screen to the right
screen.textRight();

// screen.writeMode(goRight, moveScreen)
// If goRight is true, the cursor will move right when text is written, else, it'll go left.
// if moveScreen is true, the text will be moved opposite to the cursor position when text is written. useful for scrolling text
screen.writeMode(true, false);

// screen.setCustomChar(code, bufferOrArray)
// Allows you to specify a custom character. This is stored in the LCD's RAM so it will be lost when the LCD is powered off.
// You can store 8 custom characters with codes 0 to 7.
// For example, to display the following image:
/*
░███░
█░░░█
█░░░█
░███░
█░█░░
░██░█
░░██░
░░█░░
*/
// It is encoded as so, where 1 is a filled pixel and 0 is an unfilled one
screen.setCustomChar(0, [
    0b01110,
    0b10001,
    0b10001,
    0b01110,
    0b10100,
    0b01101,
    0b00110,
    0b00100
]);

// screen.writeText(stringOrBuffer)
// Output some text on the screen
screen.writeText("Hello, world!");
// Output all your custom characters
screen.writeText("\x00\x01\x02\x03\x04\x05\x06\x07")
// Note that \n doesn't work here. Use screen.cursorSecondLine().
// Please see the note at the beginning of the readme regarding the character set.
```