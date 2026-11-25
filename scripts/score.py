"""Build three original stereo lounge loops for the offline client."""
import pathlib, subprocess, sys
import numpy as np
root = pathlib.Path(__file__).resolve().parents[1] / 'public/club'
rate = 44100
rng = np.random.default_rng(7021)
sequences = {
    'card': ((45, 52, 55, 60, 64), (41, 48, 52, 55, 59), (48, 55, 59, 62, 64), (43, 50, 53, 57, 62)),
    'dice': ((43, 50, 53, 58, 62), (48, 55, 58, 62, 65), (46, 53, 57, 60, 65), (41, 48, 51, 55, 60)),
    'tenhalf': ((48, 55, 59, 62, 67), (45, 52, 55, 59, 64), (41, 48, 52, 55, 62), (43, 50, 53, 57, 62)),
}
def add_note(audio, start, note, duration, volume, pan, timbre):
    start = int(start * rate)
    t = np.arange(int(duration * rate)) / rate
    hz = 440 * 2 ** ((note - 69) / 12)
    x = 2 * np.pi * hz * t
    if timbre == 'pad':
        envelope = np.minimum(t/.21, 1)*np.minimum((duration-t)/.68, 1)
        signal = (np.sin(x)+.4*np.sin(x*1.002)+.2*np.sin(x*2.001))*.47
    elif timbre == 'bass':
        envelope = np.minimum(t/.012, 1)*np.exp(-t*3.3)*np.minimum((duration-t)/.08, 1)
        signal = .8*np.sin(x)+.17*np.sin(x*2)
    else:
        envelope = np.minimum(t/.006, 1)*np.exp(-t*3.6)*np.minimum((duration-t)/.1, 1)
        signal = .72*np.sin(x+.24*np.exp(-t*9)*np.sin(2.003*x))+.23*np.sin(x*2.001)+.08*np.sin(x*3.002)
    signal *= envelope*volume
    for delay, gain in [(0, 1), (.18,.21), (.36,.11), (.59,.05)]:
        pos = start+int(delay*rate)
        if pos >= len(audio): continue
        used=signal[:len(audio)-pos]
        p=pan if delay==0 else 1-pan
        audio[pos:pos+len(used),0] += used*gain*(1-p)**.5
        audio[pos:pos+len(used),1] += used*gain*p**.5

for track, (name, progression) in enumerate(sequences.items()):
    beat = 60/[72, 86, 67][track]
    bars = 32
    length = bars*4*beat
    audio = np.zeros((int(rate*length),2),dtype=np.float32)
    for bar in range(bars):
        chord=progression[bar%4]
        start=bar*4*beat
        for idx,note in enumerate(chord[1:]):
            add_note(audio,start+idx*.035,note,3.96*beat,.039, .24+idx*.16,'pad')
        for tick,degree in [(0,0),(2.2,1)]:
            add_note(audio,start+tick*beat,chord[degree]-12,.86,.14,.46,'bass')
        for tick in ([.5,1.5,2.5,3.5] if name=='dice' else [.66,1.5,2.72,3.49]):
            if rng.random()<.18:continue
            note=chord[rng.integers(1,5)]+(12 if rng.random()<.23 else 0)
            add_note(audio,start+tick*beat,note,.9,.15 if name=='dice' else .123,float(rng.uniform(.18,.82)),'keys')
    fade=int(rate*.16)
    audio[:fade]*=np.linspace(0,1,fade)[:,None]
    audio[-fade:]*=np.linspace(1,0,fade)[:,None]
    audio *= .66 / max(float(np.max(np.abs(audio))), .001)
    raw = audio.astype('<f4').tobytes()
    command=['ffmpeg','-v','error','-y','-f','f32le','-ar',str(rate),'-ac','2','-i','pipe:0']
    for extension,opts in [('flac',['-sample_fmt','s32','-bits_per_raw_sample','24']),('opus',['-c:a','libopus','-b:a','84k'])]:
        subprocess.run(command + opts + [str(root/f'music-{name}.{extension}')],input=raw,check=True)
