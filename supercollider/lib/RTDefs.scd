/*
Resonant Torus — SynthDefs
Digital waveguide–inspired chamber network (tube bore + modal + delay loops).
Stable topology: exciter → chambers; links bleed to master (no input feedback).
*/

(
~rtHasMembrane = (\MembraneHexagon.asClass.notNil) or: { \MembraneCircle.asClass.notNil };
if(~rtHasMembrane) {
	"RT: MembraneHexagon / MembraneCircle (sc3-plugins) detected.".postln;
} {
	"RT: sc3-plugins membrane UGens not loaded — membrane mode uses multimodal fallback.".postln;
};

// --- Exciter (injection into the network) ---
SynthDef(\rt_exciter, { |out=0, type=0, level=0.3, rate=2, freq=65|
	var t = type.clip(0, 2);
	var pink = PinkNoise.ar(level * 0.4);
	var dust = Dust.ar(rate.clip(0.1, 40)) * level * 3;
	var noise = WhiteNoise.ar(level * 0.35);
	var sig = Select.ar(t, [pink, dust, noise]);
	Out.ar(out, LeakDC.ar(sig));
}).add;

SynthDef(\rt_exciterInject, { |exciterBus, chamberBus, level=1|
	Out.ar(chamberBus, In.ar(exciterBus, 1) * level.clip(0, 1));
}).add;

SynthDef(\rt_partial, { |out=0, freq=440, amp=0.1, detune=0, gate=1|
	var f = freq * (1 + (detune / 1200));
	var sig = SinOsc.ar(f) * amp * gate;
	Out.ar(out, Pan2.ar(sig, 0));
}).add;

SynthDef(\rt_noiseBed, { |out=0, amp=0.02, freq=65, gate=1|
	var sig = BPF.ar(PinkNoise.ar, freq * 3.5, 0.35) * amp * gate;
	Out.ar(out, Pan2.ar(sig, 0));
}).add;

~rtTubeResonator = { |exc, f, amp, decay, drift, thickness|
	var dt = (1 / f.clip(35, 4000)).clip(0.001, 0.14);
	var throat = thickness.clip(0.05, 1);
	var breath = BPF.ar(
		PinkNoise.ar(1),
		f * (0.3 + throat * 0.55),
		0.04 + throat * 0.07
	) * (0.12 + drift.max(0) * 0.04);
	var jet = HPF.ar(breath, f * 0.1);
	var drive = (exc * 0.28) + jet;
	var bore = CombL.ar(drive, 0.25, dt, decay.clip(0.12, 4));
	var boreAp = AllpassL.ar(bore, 0.12, dt * 0.41, decay.clip(0.1, 2));
	var boreLp = LPF.ar(boreAp, f * (1.8 + decay + throat));
	var boreOut = HPF.ar(boreLp, f * 0.16);
	var modes = (
		Ringz.ar(drive, f, decay.clip(0.08, 3.5)) * 0.5
		+ Ringz.ar(drive, f * 2.76, decay.clip(0.06, 2.8)) * 0.32
		+ Ringz.ar(drive, f * 4.85, decay.clip(0.04, 2.2)) * 0.18
	);
	LeakDC.ar((boreOut * 0.62 + modes * 0.38) * amp);
};

if(~rtHasMembrane) {
	SynthDef(\rt_chamber, { |inBus, outBus, masterBus, freq=100, amp=0.1, decay=0.5, drift=0, thickness=0.3, pan=0, mode=0, gate=1|
		var exc = In.ar(inBus, 1);
		var m = mode.clip(0, 4);
		var f = freq * (1 + SinOsc.kr(0.07 + drift * 0.02).range(-0.008, 0.008) * drift.max(0));
		var tension = (f * 0.002).clip(0.01, 0.09);
		var loss = (0.9992 + decay.clip(0.05, 1) * 0.00075).clip(0.999, 0.99999);
		var tube = ~rtTubeResonator.(exc, f, amp, decay, drift, thickness);
		var modal = Ringz.ar(exc, f, decay.clip(0.02, 4)) * amp;
		var dt = (1 / f.clip(30, 4000)).clip(0.0005, 0.15);
		var wg = CombL.ar(exc, 0.2, dt, decay.clip(0.05, 3));
		var waveguide = LPF.ar(wg, f * (2 + decay)) * amp * 0.85;
		var membrane = MembraneHexagon.ar(exc, tension, loss) * amp * 0.12;
		var multimodal = (
			Ringz.ar(exc, f, decay.clip(0.02, 4)) * 0.55
			+ Ringz.ar(exc, f * 1.59, decay.clip(0.02, 3)) * 0.28
			+ Ringz.ar(exc, f * 2.41, decay.clip(0.02, 2.5)) * 0.17
		) * amp * 0.45;
		var sig = LeakDC.ar(Select.ar(m, [tube, modal, waveguide, membrane, multimodal]) * gate);
		sig = sig.tanh;
		Out.ar(outBus, sig);
		Out.ar(masterBus, Pan2.ar(sig, pan.clip(-1, 1)));
	}).add;
} {
	SynthDef(\rt_chamber, { |inBus, outBus, masterBus, freq=100, amp=0.1, decay=0.5, drift=0, thickness=0.3, pan=0, mode=0, gate=1|
		var exc = In.ar(inBus, 1);
		var m = mode.clip(0, 3);
		var f = freq * (1 + SinOsc.kr(0.07 + drift * 0.02).range(-0.008, 0.008) * drift.max(0));
		var tube = ~rtTubeResonator.(exc, f, amp, decay, drift, thickness);
		var modal = Ringz.ar(exc, f, decay.clip(0.02, 4)) * amp;
		var dt = (1 / f.clip(30, 4000)).clip(0.0005, 0.15);
		var wg = CombL.ar(exc, 0.2, dt, decay.clip(0.05, 3));
		var waveguide = LPF.ar(wg, f * (2 + decay)) * amp * 0.85;
		var multimodal = (
			Ringz.ar(exc, f, decay.clip(0.02, 4)) * 0.55
			+ Ringz.ar(exc, f * 1.59, decay.clip(0.02, 3)) * 0.28
			+ Ringz.ar(exc, f * 2.41, decay.clip(0.02, 2.5)) * 0.17
		) * amp * 0.45;
		var sig = LeakDC.ar(Select.ar(m, [tube, modal, waveguide, multimodal]) * gate);
		sig = sig.tanh;
		Out.ar(outBus, sig);
		Out.ar(masterBus, Pan2.ar(sig, pan.clip(-1, 1)));
	}).add;
};

SynthDef(\rt_link, { |fromBus, masterBus, coupling=0.3, delay=0.008, throat=0.3, pan=0, gate=1|
	var src = In.ar(fromBus, 1);
	var delayed = DelayN.ar(src, 0.2, delay.clip(0.001, 0.18));
	var neckFreq = (120 + throat.clip(0.01, 1) * 900);
	var filtered = BPF.ar(delayed, neckFreq, 0.15 + throat * 0.25);
	var sig = LeakDC.ar(filtered * coupling.clip(0, 0.35) * gate).tanh;
	Out.ar(masterBus, Pan2.ar(sig, pan.clip(-1, 1)));
}).add;

SynthDef(\rt_master, { |inBus, partialBus=0, noiseBus=0, chamberMix=0.55, partialMix=0.35, noiseMix=0.1, gate=1|
	var chambers = In.ar(inBus, 2);
	var partials = In.ar(partialBus, 2);
	var noise = In.ar(noiseBus, 2);
	var sig = (chambers * chamberMix) + (partials * partialMix) + (noise * noiseMix);
	sig = LeakDC.ar(sig);
	sig = Limiter.ar(sig * gate, 0.95, 0.01);
	Out.ar(0, sig);
}).add;
)
