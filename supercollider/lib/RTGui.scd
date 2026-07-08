/*
Resonant Torus — live GUI for exciter, mix, chamber mode, model inspection.
Call ~rtShowGui.value from any thread (schedules on AppClock).
*/

~rtGui = (
	window: nil,
	modelText: nil,
	exciterMenu: nil,
	modeMenu: nil,
	deviceMenu: nil,
	inputDeviceMenu: nil,
);

~rtGuiClose = {
	~rtGui.window !? { |w| w.close };
	~rtGui.window = nil;
};

~rtGuiRefresh = {
	~rtGui.modelText !? { |t|
		t.string = try { ~rtModelSummary.value } { "(model summary unavailable)" };
	};
};

~rtGuiBuild = {
	var w, ctrl, margin = 12, row = 0, lbl, slider, summary, exciterIdx, modeIdx;
	var devices, inDevices, devIdx, inDevIdx;
	if(~rt.isNil or: { ~rt[\controls].isNil }) {
		"RT GUI: engine not loaded — evaluate ResonantTorus.scd".warn;
	} {
		~rtGuiClose.value;
		ctrl = ~rt.controls;

		w = Window("Resonant Torus — chamber network", Rect(80, 80, 420, 860))
			.front
			.onClose_({ ~rtGui.window = nil });

		StaticText(w, Rect(margin, 8, 380, 22))
			.string_("Physical model · tubular resonator network")
			.font_(Font.default.size_(13).bold_(true));

		row = 36;
		StaticText(w, Rect(margin, row, 380, 18))
			.string_("Audio I/O")
			.font_(Font.default.bold_(true));
		row = row + 22;
		lbl = { |y, text| StaticText(w, Rect(margin, y, 120, 20)).string_(text).align_(\left) };
		lbl.value(row, "Output");
		devices = ~rtListOutputDevices.value;
		devIdx = devices.indexOf(~rtCurrentOutputDevice.value) ? 0;
		~rtGui.deviceMenu = PopUpMenu(w, Rect(130, row, 250, 22))
			.items_(devices)
			.value_(devIdx)
			.action_({ |m| ~rtSetOutputDevice.(devices[m.value]) });
		row = row + 28;
		lbl.value(row, "Input");
		inDevices = ~rtListInputDevices.value;
		inDevIdx = inDevices.indexOf(~rtCurrentInputDevice.value) ? 0;
		~rtGui.inputDeviceMenu = PopUpMenu(w, Rect(130, row, 250, 22))
			.items_(inDevices)
			.value_(inDevIdx)
			.action_({ |m| ~rtSetInputDevice.(inDevices[m.value]) });
		Button(w, Rect(margin + 340, row, 56, 22))
			.states_([["Apply", Color.black, Color.gray(0.85)]])
			.action_({ ~rtRebootAudio.value });
		row = row + 36;

		slider = { |y, key, lo, hi, label|
			var st = StaticText(w, Rect(300, y, 90, 20)).string_("").align_(\right);
			Slider(w, Rect(130, y + 2, 160, 16))
				.value_((ctrl[key] - lo) / (hi - lo))
				.action_({ |sl|
					var v = lo + (sl.value * (hi - lo));
					ctrl[key] = v;
					st.string = if(v < 1) { v.round(0.01).asString } { v.round(0.1).asString };
					~rtSetControl.(key, v);
				});
			lbl.value(y, label);
			st.string = ctrl[key].round(0.01).asString;
		};

		StaticText(w, Rect(margin, row, 380, 18))
			.string_("Exciter")
			.font_(Font.default.bold_(true));
		row = row + 22;

		lbl.value(row, "Type");
		exciterIdx = case
			{ ctrl.exciterType.isKindOf(Symbol) } { ~rt.exciterTypes.indexOf(ctrl.exciterType) ? 0 }
			{ ctrl.exciterType.isKindOf(String) } { ~rt.exciterTypes.indexOf(ctrl.exciterType.asSymbol) ? 0 }
			{ true } { ctrl.exciterType.asInteger };
		~rtGui.exciterMenu = PopUpMenu(w, Rect(130, row, 160, 22))
			.items_(~rt.exciterTypes.collect(_.asString))
			.value_(exciterIdx)
			.action_({ |m|
				ctrl.exciterType = m.value;
				~rtSetControl.(\exciterType, m.value);
			});
		row = row + 28;

		lbl.value(row, "In ch");
		PopUpMenu(w, Rect(130, row, 80, 22))
			.items_(["0", "1"])
			.value_(ctrl.inputChannel.asInteger.clip(0, 1))
			.action_({ |m|
				ctrl.inputChannel = m.value;
				~rtSetControl.(\inputChannel, m.value);
			});
		row = row + 28;

		slider.value(row, \exciterLevel, 0, 1, "Level"); row = row + 26;
		slider.value(row, \exciterRate, 0.2, 20, "Rate"); row = row + 30;

		StaticText(w, Rect(margin, row, 380, 18))
			.string_("Playback")
			.font_(Font.default.bold_(true));
		row = row + 22;
		lbl.value(row, "Mode");
		PopUpMenu(w, Rect(130, row, 160, 22))
			.items_(["drone", "trigger"])
			.value_(ctrl.playMode.asInteger.clip(0, 1))
			.action_({ |m|
				ctrl.playMode = m.value;
				~rtSetControl.(\playMode, m.value);
			});
		row = row + 28;
		slider.value(row, \envAttack, 0.001, 2, "Attack"); row = row + 26;
		slider.value(row, \envDecay, 0.001, 2, "Decay"); row = row + 26;
		slider.value(row, \envSustain, 0, 1, "Sustain"); row = row + 26;
		slider.value(row, \envRelease, 0.001, 4, "Release"); row = row + 30;

		StaticText(w, Rect(margin, row, 380, 18))
			.string_("Mix")
			.font_(Font.default.bold_(true));
		row = row + 22;
		slider.value(row, \chamberMix, 0, 1, "Chambers"); row = row + 26;
		slider.value(row, \partialsMix, 0, 1, "Partials"); row = row + 26;
		slider.value(row, \noiseMix, 0, 1, "Noise bed"); row = row + 30;

		StaticText(w, Rect(margin, row, 380, 18))
			.string_("Chamber resonator")
			.font_(Font.default.bold_(true));
		row = row + 22;
		lbl.value(row, "Mode");
		modeIdx = case
			{ ctrl.chamberMode.isKindOf(Symbol) } { ~rt.chamberModes.indexOf(ctrl.chamberMode) ? 0 }
			{ ctrl.chamberMode.isKindOf(String) } { ~rt.chamberModes.indexOf(ctrl.chamberMode.asSymbol) ? 0 }
			{ true } { ctrl.chamberMode.asInteger };
		~rtGui.modeMenu = PopUpMenu(w, Rect(130, row, 160, 22))
			.items_(~rt.chamberModes.collect(_.asString))
			.value_(modeIdx)
			.action_({ |m|
				ctrl.chamberMode = m.value;
				~rtSetControl.(\chamberMode, m.value);
			});
		row = row + 34;

		Button(w, Rect(margin, row, 120, 24))
			.states_([["Load demo", Color.black, Color.gray(0.85)]])
			.action_({ ~rtLoadDemo.value });

		Button(w, Rect(margin + 130, row, 120, 24))
			.states_([["Rebuild graph", Color.black, Color.gray(0.85)]])
			.action_({ ~rt.lastPayload !? { ~rtHandlePayload.(~rt.lastPayload) } });

		Button(w, Rect(margin + 260, row, 120, 24))
			.states_([["Load JSON…", Color.black, Color.gray(0.85)]])
			.action_({
				FileDialog({ |paths|
					if(paths.notNil and: { paths.size > 0 }) {
						~rtLoadFile.(paths[0]);
					};
				}, fileMode: 1, acceptMode: 0);
			});
		row = row + 34;

		StaticText(w, Rect(margin, row, 380, 18))
			.string_("Loaded organism model")
			.font_(Font.default.bold_(true));
		row = row + 22;

		summary = try { ~rtModelSummary.value } { |err|
			"RT GUI summary error: %".format(err.errorString).warn;
			"(model summary unavailable)";
		};
		~rtGui.modelText = StaticText(w, Rect(margin, row, 390, 200))
			.string_(summary)
			.font_(Font.monospace.size_(11))
			.align_(\left);

		~rtGui.window = w;
		"RT GUI open.".postln;
	};
};

~rtShowGui = {
	AppClock.sched(0, {
		try { ~rtGuiBuild.value } { |err| err.reportError };
		nil;
	});
	"RT GUI scheduled (check post window for 'RT GUI open.')".postln;
};
