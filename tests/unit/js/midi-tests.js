/*!
* Flocking MIDI Unit Generator Unit Tests
* http://github.com/colinbdclark/flocking
*
* Copyright 2011-2015, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global require*/

var fluid = fluid || require("infusion"),
    jqUnit = jqUnit || fluid.require("node-jqunit"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var QUnit = fluid.registerNamespace("QUnit");

    var environment = flock.silentEnviro();

    var testPort = {
        manufacturer: "KORG INC.",
        name: "SLIDER/KNOB"
    };

    var testMatch = function (name, matcherType, matchSpec, port, matchExpected) {
        QUnit.test(name, function () {
            var matcher = fluid.invokeGlobalFunction(matcherType, [matchSpec]);
            var didMatch = matcher(port);

            var msg = matchExpected ? "The match specification should have matched the port." :
                "The match specification should not have matched the port.";

            QUnit.equal(didMatch, matchExpected, msg);
        });
    };

    var runMatchTests = function (testSpecsByType) {
        for (var matcherType in testSpecsByType) {
            var testSpecs = testSpecsByType[matcherType];
            QUnit.module("Port Matcher: " + matcherType);
            for (var i = 0; i < testSpecs.length; i++) {
                var spec = testSpecs[i];
                testMatch(spec.name, matcherType, spec.matchSpec, spec.port, spec.shouldMatch);
            }
        }
    };

    var matchTestSpecs = {
        "flock.midi.findPorts.lowerCaseContainsMatcher": [
            {
                name: "Single-property complete match",
                matchSpec: {
                    manufacturer: "KORG INC."
                },
                port: testPort,
                shouldMatch: true
            },
            {
                name: "Single property mismatch",
                matchSpec: {
                    manufacturer: "AKAI"
                },
                port: testPort,
                shouldMatch: false
            },
            {
                name: "Multiple property complete match",
                matchSpec: {
                    manufacturer: "KORG INC.",
                    name: "SLIDER/KNOB"
                },
                port: testPort,
                shouldMatch: true
            },
            {
                name: "Multiple property mismatch",
                matchSpec: {
                    manufacturer: "AKAI",
                    name: "SLIDER/KNOB"
                },
                port: testPort,
                shouldMatch: false
            },
            {
                name: "Single property partial match",
                matchSpec: {
                    manufacturer: "KORG"
                },
                port: testPort,
                shouldMatch: true
            },
            {
                name: "Multiple property partial match",
                matchSpec: {
                    manufacturer: "KORG",
                    name: "SLIDER"
                },
                port: testPort,
                shouldMatch: true
            },
            {
                name: "Single property wildcard match",
                matchSpec: {
                    name: "*"
                },
                port: testPort,
                shouldMatch: true
            },
            {
                name: "Multiple property wildcard match",
                matchSpec: {
                    manufacturer: "KORG INC.",
                    name: "*"
                },
                port: testPort,
                shouldMatch: true
            }
        ]
    };

    runMatchTests(matchTestSpecs);


    QUnit.module("flock.ugen.midiFreq tests");

    var testNoteControl = function (ugen, midiNote, expected, msg) {
        if (midiNote) {
            ugen.set("note", midiNote);
        }

        if (ugen.get("note").gen) {
            ugen.get("note").gen(1);
        }
        ugen.gen(1);
        flock.test.equalRounded(2, ugen.output[0], expected, msg);
    };

    var testNotesControl = function (ugen, testSpecs) {
        fluid.each(testSpecs, function (testSpec) {
            testNoteControl(ugen, testSpec.midiNote, testSpec.expectedFreq, testSpec.msg);
        });
    };

    QUnit.test("12TET/A440, constant rate input", function () {
        var midiFreq = flock.parse.ugenDef({
            ugen: "flock.ugen.midiFreq",
            note: 60
        });

        testNotesControl(midiFreq, [
            {
                midiNote: 60,
                expectedFreq: 261.63,
                msg: "C4 (MIDI 60) should be converted to 261.64 Hz."
            },
            {
                midiNote: 21,
                expectedFreq: 27.50,
                msg: "A0 (MIDI 21) should be converted to 27.5 Hz."
            },
            {
                midiNote: 108,
                expectedFreq: 4186.01,
                msg: "C8 (MIDI 108) should be converted to 4186 Hz."
            }
        ]);
    });

    QUnit.test("12TET/A440, control rate input", function () {
        var midiFreq = flock.parse.ugenDef({
            ugen: "flock.ugen.midiFreq",
            note: {
                ugen: "flock.ugen.sequence",
                rate: "control",
                values: [21, 22, 23],
                freq: 10000
            }
        });

        testNotesControl(midiFreq, [
            {
                expectedFreq: 27.50,
                msg: "The frequency value of the first item in the sequence should be returned (MIDI 21)."
            },
            {
                expectedFreq: 29.14,
                msg: "The frequency value of the next item in the sequence should be returned (MIDI 22)."
            },
            {
                expectedFreq: 30.87,
                msg: "The frequency value of the last item in the sequence should be returned (MIDI 23)."
            }
        ]);
    });

    var testEncoding = function (testDef) {
        var expectedRawMidi = flock.midi.rawMIDIParser.parseMIDICommand(testDef.expected);
        var encodedRawMidi = flock.midi.jsonToMidiMessage(testDef.input);
        jqUnit.assertDeepEq(testDef.message, expectedRawMidi, encodedRawMidi);
    };

    var testDecoding = function (testDef) {
        var rawMidiInput = flock.midi.rawMIDIParser.parseMIDICommand(testDef.input);
        var decodedMidiAsJson = flock.midi.read(rawMidiInput);
        jqUnit.assertDeepEq(testDef.message, testDef.expected, decodedMidiAsJson);
    };

    QUnit.test("Encoding of JSON as raw MIDI", function () {
        var encodingTestSpecs = {
            noteOn: {
                message: "We should be able to encode a noteOn message.",
                input: {
                    "chan": 0,
                    "note": 60,
                    "type": "noteOn",
                    "velocity": 69
                },
                expected: "90 3C 45"
            },
            noteOff: {
                message: "We should be able to encode a noteOff message.",
                input: {
                    "chan": 0,
                    "note": 60,
                    "type": "noteOff",
                    "velocity": 0
                },
                expected: "90 3C 00"
            },
            afterTouch: {
                message: "We should be able to encode an aftertouch (non poly) message.",
                input: {
                    "chan": 0,
                    "type": "aftertouch",
                    "pressure": 87
                },
                expected: "D0 57"
            },
            control: {
                message: "We should be able to encode a control message.",
                input: {
                    "chan": 2,
                    "number": 74,
                    "type": "control",
                    "value": 116
                },
                expected: "B2 4A 74"
            },
            program: {
                message: "We should be able to encode a program message.",
                input: {
                    "chan": 2,
                    "program": 7,
                    "type": "program"
                },
                expected: "C2 07"
            },
            pitchbend: {
                message: "We should be able to encode a pitchbend message.",
                input: {
                    "chan": 1,
                    "type": "pitchbend",
                    "value": 5888
                },
                expected: "E1 00 2E"
            },
            sysex: {
                message:  "We should be able to encode a sysex message.",
                input: {
                    "data": {
                        "0": 240,
                        "1": 0,
                        "2": 32,
                        "3": 8,
                        "4": 16,
                        "5": 127,
                        "6": 0,
                        "7": 1,
                        "8": 247
                    },
                    "type": "sysex"
                },
                expected: "F0 00 20 08 10 7F 00 01 F7"

            },
            songPointer: {
                message:  "We should be able to encode a songPointer message.",
                input: {
                    "type": "songPointer",
                    "value": 1
                },
                expected: "F2 01"
            },
            songSelect: {
                message:  "We should be able to encode a songSelect message.",
                input: {
                    "type": "songSelect",
                    "value": 1
                },
                expected: "F3 01"
            },
            tuneRequest: {
                message:  "We should be able to encode a tuneRequest message.",
                input: {
                    "type": "tuneRequest"
                },
                expected: "F6"
            },
            clock: {
                message:  "We should be able to encode a clock message.",
                input: {
                    "type": "clock"
                },
                expected: "F8"
            },
            start: {
                message:  "We should be able to encode a start message.",
                input: {
                    "type": "start"
                },
                expected: "FA"
            },
            continue: {
                message:  "We should be able to encode a continue message.",
                input: {
                    "type": "continue"
                },
                expected: "FB"
            },
            stop: {
                message:  "We should be able to encode a stop message.",
                input: {
                    "type": "stop"
                },
                expected: "FC"
            },
            reset: {
                message:  "We should be able to encode a reset message.",
                input: {
                    "type": "reset"
                },
                expected: "FF"
            },
            activeSense: {
                message:  "We should be able to encode an activeSense message.",
                input: {
                    "type": "activeSense"
                },
                expected: "FE"
            }
        };
        fluid.each(encodingTestSpecs, testEncoding);
    });

    QUnit.test("Decoding of raw MIDI into JSON", function () {
        var decodingTestSpecs = {
            noteOn: {
                message:  "We should be able to decode a noteOn message.",
                input:    "90 3C 45",
                expected: {
                    "chan": 0,
                    "note": 60,
                    "type": "noteOn",
                    "velocity": 69
                }
            },
            noteOff: {
                message:  "We should be able to decode a noteOff message.",
                input:    "90 3C 00",
                expected: {
                    "chan": 0,
                    "note": 60,
                    "type": "noteOff",
                    "velocity": 0
                }
            },
            afterTouch: {
                message: "We should be able to decode an aftertouch (non poly) message.",
                input:   "D0 57",
                expected: {
                    "chan": 0,
                    "type": "aftertouch",
                    "pressure": 87
                }
            },
            control: {
                message: "We should be able to decode a control message.",
                input:   "B2 4A 74",
                expected: {
                    "chan": 2,
                    "number": 74,
                    "type": "control",
                    "value": 116
                }
            },
            program: {
                message: "We should be able to decode a program message.",
                input:   "C2 07",
                expected: {
                    "chan": 2,
                    "program": 7,
                    "type": "program"
                }
            },
            pitchbend: {
                message: "We should be able to decode a pitchbend message.",
                input:   "E1 00 2E",
                expected: {
                    "chan": 1,
                    "type": "pitchbend",
                    "value": 5888
                }
            },
            sysex: {
                message:  "We should be able to decode a sysex message.",
                input:    "F0 00 20 08 10 7F 00 01 F7",
                expected: {
                    "data": {
                        "0": 240,
                        "1": 0,
                        "2": 32,
                        "3": 8,
                        "4": 16,
                        "5": 127,
                        "6": 0,
                        "7": 1,
                        "8": 247
                    },
                    "type": "sysex"
                }

            },
            songPointer: {
                message:  "We should be able to decode a songPointer message.",
                input:    "F2 01",
                expected: {
                    "type": "songPointer",
                    "value": 1
                }
            },
            songSelect: {
                message:  "We should be able to decode a songSelect message.",
                input:    "F3 01",
                expected: {
                    "type": "songSelect",
                    "value": 1
                }
            },
            tuneRequest: {
                message:  "We should be able to decode a tuneRequest message.",
                input:    "F6",
                expected: {
                    "type": "tuneRequest"
                }
            },
            clock: {
                message:  "We should be able to decode a clock message.",
                    input:    "F8",
                    expected: {
                    "type": "clock"
                }
            },
            start: {
                message:  "We should be able to decode a start message.",
                input:    "FA",
                expected: {
                    "type": "start"
                }
            },
            continue: {
                message:  "We should be able to decode a continue message.",
                input:    "FB",
                expected: {
                    "type": "continue"
                }
            },
            stop: {
                message:  "We should be able to decode a stop message.",
                input:    "FC",
                expected: {
                    "type": "stop"
                }
            },
            reset: {
                message:  "We should be able to decode a reset message.",
                input:    "FF",
                expected: {
                    "type": "reset"
                }
            },
            activeSense: {
                message:  "We should be able to decode an activeSense message.",
                input:    "FE",
                expected: {
                    "type": "activeSense"
                }
            }
        };
        fluid.each(decodingTestSpecs, testDecoding);
    });

    environment.destroy();
}());
