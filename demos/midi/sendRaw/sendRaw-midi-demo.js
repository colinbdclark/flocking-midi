/*global fluid, flock*/

(function () {
    "use strict";

    fluid.defaults("flock.demo.rawMIDIInputView", {
        gradeNames: "fluid.codeMirror",

        codeMirrorOptions: {
            lineWrapping: true,
            readOnly: true
        },

        theme: "flockingcm",
        lineNumbers: true,
        lineWrapping: true,

        model: {
            content: "F0 7E 7F 06 01 F7"
        },

        invokers: {
            updateContent: {
                funcName: "flock.demo.rawMIDIInputView.updatedContentModel",
                args: ["{that}"]
            }
        },

        listeners: {
            onCreate: "{that}.setContent({that}.model.content)"
        }
    });

    flock.demo.rawMIDIInputView.updatedContentModel = function (that) {
        var content = that.getContent();
        that.applier.change("content", content);
    };

    fluid.defaults("flock.demo.rawMIDISender", {
        gradeNames: "fluid.viewComponent",

        commandDelay: 0.1,

        model: {
            commandScore: []
        },

        modelRelay: {
            target: "commandScore",
            singleTransform: {
                type: "fluid.transforms.free",
                func: "flock.demo.rawMIDISender.schedulerScoreForCommands",
                args: ["{that}.parser.model.commands", "{that}"]
            }
        },

        invokers: {
            send: "{that}.events.onSend.fire"
        },

        components: {
            connector: {
                type: "flock.ui.midiConnector",
                container: "{that}.dom.midiPortSelector",
                options: {
                    portType: "output",
                    components: {
                        connection: {
                            options: {
                                sysex: true
                            }
                        }
                    }
                }
            },
            parser: {
                type: "flock.midi.rawMIDIParser"
            },

            midiInputView: {
                type: "flock.demo.rawMIDIInputView",
                container: "{that}.dom.rawMIDIArea"
            },

            scheduler: {
                type: "flock.scheduler.async"
            }
        },

        events: {
            onSend: null
        },

        listeners: {
            onCreate: [
                {
                    "this": "{that}.dom.sendButton",
                    method: "click",
                    args: ["{that}.send"]
                }
            ],

            onSend: [
                {
                    priority: "first",
                    func: "{midiInputView}.updateContent"
                },
                {
                    priority: "last",
                    funcName: "flock.demo.rawMIDISender.enqueueMIDICommands",
                    args: ["{that}.model.commandScore", "{that}"]
                }
            ]
        },

        selectors: {
            rawMIDIArea: "#code",
            sendButton: "button.send",
            midiPortSelector: "#midi-port-selector"
        }
    });

    flock.demo.rawMIDISender.sendCommand = function (command, that) {
        that.connector.connection.sendRaw(command);
    };

    flock.demo.rawMIDISender.schedulerScoreForCommands = function (commands, that) {
        return fluid.transform(commands, function (command, i) {
            return {
                interval: "once",
                time: i * that.options.commandDelay,
                change: function () {
                    flock.demo.rawMIDISender.sendCommand(command, that);
                }
            };
        });
    };

    flock.demo.rawMIDISender.enqueueMIDICommands = function (commandScore, that) {
        if (commandScore.length < 1 || !that.connector.connection) {
            return;
        }

        // Stop any currently-queued MIDI commands prior to sending new ones.
        that.scheduler.clearAll();
        that.scheduler.schedule(commandScore);
    };
}());
