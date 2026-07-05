/*
Resonant Torus — SuperCollider chain resonator receiver

Prerequisites:
  Quarks.install("WebSocket");
  npm run bridge   (in resonant-torus project)

Browser → ws://localhost:57120
SuperCollider → ws://localhost:57121

Evaluate this file, then enable "connect" in the app Tools panel.
*/

(
var ws, partialSynths, chamberSynths, routeSynths;

~cleanup = {
	partialSynths !? { partialSynths.do(_.free); partialSynths = nil };
	chamberSynths !? { chamberSynths.do(_.free); chamberSynths = nil };
	routeSynths !? { routeSynths.do(_.free); routeSynths = nil };
	ws !? { ws.close; ws = nil };
	"Resonant Torus SC receiver stopped.".postln;
};

~start = {
	~cleanup.value;
	partialSynths = List.new;
	chamberSynths = List.new;
	routeSynths = List.new;

	ws = WebSocket.new("ws://localhost:57121", { |ws|
		"Connected to Resonant Torus bridge.".postln;
		ws.onMessage = { |msg|
			var data = msg.parseJSON;
			if(data[\type] == "acoustic_model") {
				{ ~handleModel.value(data) }.defer;
			};
		};
	});
};

~handleModel = { |data|
	var sc = data[\superCollider];
	var freq, partials, chambers, routes, noise;

	if(sc.isNil) { ^nil };

	freq = sc[\freq] ? 65;
	partials = sc[\partials] ? [];
	chambers = sc[\chambers] ? [];
	routes = sc[\routes] ? [];
	noise = sc[\noise] ? 0;

	partialSynths !? { partialSynths.do(_.free); partialSynths = List.new };
	chamberSynths !? { chamberSynths.do(_.free); chamberSynths = List.new };
	routeSynths !? { routeSynths.do(_.free); routeSynths = List.new };

	"▸ fundamental: % Hz | lumps: % | chain links: %".format(
		freq.round(0.1), chambers.size, routes.size
	).postln;

	// Global harmonic bed (pure torus → perfect partial stack)
	partials.do { |p|
		var harm = p[0], amp = p[1], detune = p[2];
		partialSynths.add(Synth(\rt_partial, [
			\freq, freq * harm,
			\amp, amp.clip(0, 1) * 0.07,
			\detune, detune
		]));
	};

	// One reson~ per lump (sorted by chainIndex in the payload)
	chambers.do { |c|
		var cf, ca, decay, drift, thick;
		// supports both object and legacy [freq, amp, decay] arrays
		if(c.isArray) {
			cf = c[0]; ca = c[1]; decay = c[2]; drift = 0; thick = 0.3;
		} {
			cf = c[\freq] ? c[\frequency];
			ca = c[\amp] ? c[\amplitude];
			decay = c[\decay];
			drift = (c[\drift] ? c[\driftHz]) ? 0;
			thick = c[\thickness] ? 0.3;
		};

		chamberSynths.add(Synth(\rt_chamber, [
			\freq, cf,
			\amp, ca.clip(0, 1) * (0.04 + thick * 0.06),
			\decay, decay.clip(0.05, 2),
			\drift, drift,
			\pan, (c[\chainIndex] ? 0) / chambers.size * 2 - 1
		]));
	};

	// Serial chain links between adjacent lumps
	routes.do { |r|
		var coupling, delayMs, throat;
		if(r.isArray) {
			coupling = 0.3; delayMs = 8; throat = 0.2;
		} {
			coupling = r[\coupling] ? 0.3;
			delayMs = r[\delayMs] ? 8;
			throat = r[\throat] ? 0.2;
		};

		routeSynths.add(Synth(\rt_chainLink, [
			\coupling, coupling.clip(0, 1),
			\delay, delayMs / 1000,
			\throat, throat.clip(0.01, 1),
			\amp, 0.04
		]));
	};

	if(noise > 0.01) {
		Synth(\rt_noise, [\amp, noise * 0.03, \freq, freq]);
	};
};

// --- SynthDefs ---

// Harmonic partial (global timbre)
SynthDef(\rt_partial, { |out=0, freq=440, amp=0.1, detune=0|
	var sig = SinOsc.ar(freq * (1 + detune / 1200)) * amp;
	Out.ar(out, Pan2.ar(sig, 0));
}).add;

// Lump resonator — thicker section = louder, longer ring
SynthDef(\rt_chamber, { |out=0, freq=220, amp=0.05, decay=0.5, drift=0, pan=0|
	var exc = Dust.ar(0.4);
	var f = freq * (1 + SinOsc.kr(drift * 0.15).range(-0.01, 0.01));
	var sig = Ringz.ar(exc, f, decay) * amp;
	Out.ar(out, Pan2.ar(sig, pan));
}).add;

// Coupling between chain neighbours (delay + filtered bleed)
SynthDef(\rt_chainLink, { |out=0, coupling=0.3, delay=0.01, throat=0.3, amp=0.03|
	var src = In.ar(out, 2);
	var delayed = DelayN.ar(src, 0.2, delay);
	var filtered = BPF.ar(delayed, 200 + (throat * 800), 0.25);
	Out.ar(out, filtered * coupling * amp);
}).add;

SynthDef(\rt_noise, { |out=0, amp=0.02, freq=65|
	var sig = BPF.ar(PinkNoise.ar, freq * 4, 0.3) * amp;
	Out.ar(out, Pan2.ar(sig, 0));
}).add;

~start.value;
)

/*
To stop:
~cleanup.value;

--- Mapping guide ---

JSON payload (data.superCollider):

  freq        → global fundamental Hz
  partials    → [[harmonic, amplitude, detune_cents], ...]
  chambers[]  → { id, chainIndex, freq, amp, decay, thickness, drift, ringAngle }
  routes[]    → { from, to, coupling, delayMs, throat }  // serial chain
  noise       → 0..1 noise amount

Patch mental model (like Pd/Max):

  [osc~ partials] ──global harmonic bed
  [reson~ 0]──[reson~ 1]──[reson~ 2]──...  serial lump chain
       ↑ each route is a delay + BPF coupling (throat width)

chainIndex orders modules around the torus ring.
thickness → chamber amp & decay in the receiver.
drift     → slow freq wobble on each reson~.
*/
