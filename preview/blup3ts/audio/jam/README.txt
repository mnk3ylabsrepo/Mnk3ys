BLUP3TS Jam recordings (drop-in folder)

Put your own instrument recordings here to replace the built-in instrument sounds in Jam.

1. Record one beat of the instrument (0.5 s at 120 BPM; it may ring on longer), in E minor
   pentatonic (E G A B D) so it fits the Jam beat. Start the sound right at the beginning of the file.
2. Save it as mp3 (mono or stereo, 44.1 kHz), for example bass_all.mp3 or bass_legendary.mp3.
3. List it in config.js under JAM_RECORDINGS, per pet rarity, for example:
     bass: { all: 'bass_all.mp3', legendary: 'bass_legendary.mp3' },
   Rarity keys: common, uncommon, rare, legendary, or all for every rarity.
   Anything left empty keeps the built-in sound.

Each tap plays the recording on the next 16th note of the beat. Recordings are loudness-matched when
they load and go through the same equaliser pass as the built-in sounds, so they sit at an even volume.
Instrument ids: bass, guitar, drumsticks, mic, keytar, keys, shaker, horn, pad.

Made by Azgog (@azgog)
