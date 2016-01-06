// A lot of the WebMidi code in this example comes from Chris Wilson. Thanks Chris! https://github.com/cwilso/monosynth

window.AudioContext = window.AudioContext || window.webkitAudioContext || window.mozAudioContext || window.oAudioContext || window.msAudioContext;

var MRS = function(){
	var _this = this;

	// decibel levels of the each tone's harmonics starting at the low C and ending at the B almost 3 octaves higher.
	this.db_coeffs_table = [
		[-100,-59.80,-49.60,-32.89,-23.52,-23.95,-27.71,-30.47,-21.51,-18.81,-19.12,-32.47],
		[-100, -52.80,-40.97,-25.53,-19.42,-20.71,-23.86,-21.63,-14.79,-20,-33.00,-33.79,-35.44,-36.43,-34.45,-34.48],
		[-100,-51.57,-38.78,-23.12,-23.07,-23.89,-25.42,-18.84,-18.06,-29.41,-32.24],
		[-100 ,-51.13,-37.73,-26.80,-20.05,-24.92,-24.00,-18.73,-15.05,-28.64,-33.86,-34.82,-33.57],
		[-100,-51.05,-34.83,-22.54,-23.55,-27.68,-20.32,-15.29,-22.92,-31.56,-35.37],
		[-100,-53.22,-29.76,-20.69,-24.90,-28.87,-23.11,-13.59,-32.42,-40.90,-34.69,-34.75,-36.90],
		[-100,-53.75,-27.33,-23.20,-28.54,-23.61,-18.89,-22.81,-32.50,-39.38,-34.09,-36.60,-39.30],
		[-100,-45.29,-23.06,-17.99,-24.24,-19.23,-11.65,-29.31,-31.64,-32.58,-32.34,-39.98],
		[-100,-40.29,-26.43,-19.63,-25.35,-18.89,-19.65,-30.49,-28.68,-31.55,-36.59,-42.86],
		[-57.88,-39.86,-25.02,-26.09,-25.68,-14.87,-27.13,-34.66,-33.57,-36.63,-38.30],
		[-100,-35.02,-18.63,-25.36,-20.18,-11.92,-31.39,-30.53,-31.66,-38.67,-40.95],
		[-100,-33.25,-21.41,-27.02,-18.38,-22.62,-36.12,-33.43,-36.50,-40.01,-37.81],
		[-54.08,-27.65,-18.07,-23.68,-12.81,-28.66,-32.10,-31.65,-38.71,-36.89,-31.81],
		[-49.24,-24.27,-17.63,-19.25,-10.10,-31.82,-30.72,-36.24,-42.85,-37.56,-29.91],
		[-46.23,-20.94,-20.56,-16.99,-17.34,-29.73,-26.93,-34.33,-33.30,-28.76,-32.14],
		[-48.51,-25.69,-23.50,-16.89,-26.49,-28.38,-32.38,-41.29,-34.80,-29.21],
		[-50.61,-23.35,-27.40,-14.27,-32.24,-32.12,-39.71,-37.59,-33.09,-35.01],
		[-48.91,-17.76,-22.64,-11.04,-31.54,-29.85,-39.15,-36.46,-30.89,-38.19],
		[-47.13,-18.53,-17.51,-20.76,-29.04,-34.75,-33.20,-29.17,-33.54,-43.62],
		[-41.00,-14.09,-16.05,-23.76,-30.78,-33.48,-34.21,-28.01,-37.02],
		[-38.66,-17.81,-16.43,-31.08,-29.49,-40.09,-29.09,-33.11,-46.50],
		[-38.98,-23.22,-12.62,-31.38,-35.67,-35.07,-28.41,-38.66],
		[-35.15,-23.87,-11.12,-28.46,-36.50,-36.17,-29.50,-42.65],
		[-29.50,-21.48,-17.91,-26.34,-33.34,-27.63,-35.10],
		[-19.93,-15.58,-19.18,-23.57,-27.65,-23.52,-35.58],
		[-18.78,-13.89,-25.63,-29.50,-29.15,-29.95],
		[-19.02,-15.11,-26.53,-32.12,-26.22,-34.94],
		[-25.60,-18.06,-27.28,-38.54,-27.47,-43.08],
		[-21.84,-13.60,-30.19,-35.21,-32.25],
		[-17.68,-10.15,-29.13,-35.01,-37.03],
		[-16.68,-18.48,-32.35,-26.86,-37.51],
		[-17.55,-20.50,-28.54,-25.11,-49.42],
		[-15.90,-24.03,-35.24,-26.92,-48.50],
		[-16.62,-25.13,-28.50,-34.55,-50.97],
		[-16.71,-23.58,-26.65,-37.83],
		[-18.38,-22.41,-21.68,-47.29,]
	];

	this.context = new AudioContext();
	this.envelope = this.context.createGain();
	this.envelope.gain.value = 0.3;
	this.envelope.connect(this.context.destination);
	this.blackKeyColour = '#403e30';
	this.activeColour = '#5b5745';
	this.upperLimitNote = 95;
	this.lowerLimitNote = 55;
	this.activeNotes = []; // the stack of actively-pressed keys
	this.periodicWaves = [];

	// Qwerty Hancock keyboard
	this.keyboard = new QwertyHancock({
		id: 'js-keyboard',
		width: 340,
		height: 140,
		octaves: 3,
		startNote: 'C4',
		whiteKeyColour: 'transparent',
		blackKeyColour: this.blackKeyColour,
		borderColour: this.blackKeyColour,
		hoverColour: this.activeColour,
		activeColour: this.activeColour
	});

	this.createPeriodicWaves = function(){
		for (var j = 0 ; j < this.db_coeffs_table.length ; j++){
			var coeffs = [0]; //set first fourier coeff to 0 because we don't want any dc offset.
			for (var i = 0; i < this.db_coeffs_table[j].length ; i++){
				//convert the non-dc fourier coeffs from dB to intensity, relative to a max of 1.
				coeffs[i+1] = Math.pow(10,(this.db_coeffs_table[j][i]/20));
			}
			var real = new Float32Array(coeffs);
			var imag = new Float32Array(real.length);
			this.periodicWaves.push(this.context.createPeriodicWave(real, imag));
		}
	}


	this.noteOn = function(noteNumber) {
		if (noteNumber >= this.lowerLimitNote && noteNumber <= this.upperLimitNote){
			this.activeNotes.forEach(function(element){
				element.stop();
			});

			var noteIndex = noteNumber - 60;
			if (noteIndex < 0){
				noteIndex = 0;
			}

			var osc = this.context.createOscillator();
			osc.setPeriodicWave(this.periodicWaves[noteIndex]);    			
			osc.frequency.value = MIDIUtils.frequencyFromNoteNumber(noteNumber);
			osc.connect(this.envelope);
			osc.start(0);
			this.activeNotes[noteNumber] = osc;
			$("li[title=" + MIDIUtils.noteNumberToName(noteNumber) + "]").css("background", this.activeColour);
		}
	}

	this.noteOff = function (noteNumber) {
		if (noteNumber >= this.lowerLimitNote && noteNumber <= this.upperLimitNote){
			this.activeNotes[noteNumber].stop();
			var resetColor = MIDIUtils.noteNumberToName(noteNumber).indexOf("#") == -1 ? "transparent" : this.blackKeyColour;
			$("li[title=" + MIDIUtils.noteNumberToName(noteNumber) + "]").css("background", resetColor);
		}
	}

	// midi functions
	this.onMIDISuccess = function(midiAccess) {
	    // when we get a succesful response, run this code
	    _this.midi = midiAccess; // this is our raw MIDI data, inputs, outputs, and sysex status

	    var inputs = _this.midi.inputs.values();
	    // loop over all available inputs and listen for any MIDI input
	    for (var input = inputs.next(); input && !input.done; input = inputs.next()) {
	        // each time there is a midi message call the onMIDIMessage function
	        input.value.onmidimessage = _this.onMIDIMessage;
	    }
	}

	this.onMIDIFailure = function(e) {
	    // when we get a failed response, run this code
	    console.log("No access to MIDI devices or your browser doesn't support WebMIDI API. Please use WebMIDIAPIShim " + e);
	}

	this.onMIDIMessage = function(message) {
	    data = message.data; // this gives us our [command/channel, note, velocity] data.

	    // Mask off the lower nibble (MIDI channel, which we don't care about)
	    switch (message.data[0] & 0xf0) {
	    	case 0x90:
	    		if (message.data[2]!=0) {  // if velocity != 0, this is a note-on message
	    			_this.noteOn(message.data[1]);
	    			return;
	    		}
			// if velocity == 0, fall thru: it's a note-off.  MIDI's weird, ya'll.
			case 0x80:
	    		_this.noteOff(message.data[1]);
	    		return;
		}
	}



	this.keyboard.keyDown = function (note, frequency) {
		noteNumber = MIDIUtils.frequencyToNoteNumber(frequency);
		_this.noteOn(noteNumber);
	};

	this.keyboard.keyUp = function (note, frequency) {
		noteNumber = MIDIUtils.frequencyToNoteNumber(frequency);
		_this.noteOff(noteNumber);	
	};


	this.init = function(){
		this.requestMIDIAccess();
		this.createPeriodicWaves();
	}

	this.requestMIDIAccess = function(){
		if (navigator.requestMIDIAccess) {
			navigator.requestMIDIAccess({
		    }).then(_this.onMIDISuccess, _this.onMIDIFailure);
		} else {
			console.log("No MIDI support in your browser. Please try again with Chrome.");
		}
	}

	MIDIUtils.init();
	this.init();
}


// Based on Midi Utils Library
// https://github.com/sole/MIDIUtils/blob/master/src/MIDIUtils.js

var MIDIUtils = {

	noteMap: {},
	noteNumberMap: [],
	notes: [ "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B" ],

	init: function(){

		for (var i = 0; i < 127; i++) {

			var index = i,
			key = this.notes[index % 12],
		    octave = ((index / 12) | 0) - 1; // MIDI scale starts at octave = -1

		    if(key.length === 1) {
		    	key = key;
		    }

		    key += octave;

		    this.noteMap[key] = i;
		    this.noteNumberMap[i] = key;
		}
	},

	getBaseLog: function(value, base) {
		return Math.log(value) / Math.log(base);
	},

	frequencyFromNoteNumber: function(note) {
		return 440 * Math.pow(2,(note-57)/12);
	},

	noteNumberToName: function(note) {

		return this.noteNumberMap[note];
	},

	frequencyToNoteNumber: function(f) {
		return Math.round(12.0 * this.getBaseLog(f / 440.0, 2) + 69);
	}

};

var mrs = new MRS();

