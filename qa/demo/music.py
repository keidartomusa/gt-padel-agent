# Self-made royalty-free background: soft plucked arpeggios over pads, C-Am-F-G, 96 bpm.
import numpy as np, wave, sys
sr=44100; dur=float(sys.argv[1]); bpm=96; beat=60/bpm
def n2f(n): return 440*2**((n-69)/12)
chords=[[60,64,67,72],[57,60,64,69],[53,57,60,65],[55,59,62,67]]
out=np.zeros(int(sr*(dur+4)))
t8=beat/2; i=0; t=0.0
while t<dur+2:
    ch=chords[int(t/(beat*4))%4]
    if abs((t/(beat*4))%1)<1e-6:
        L=int(sr*beat*4); tt=np.arange(L)/sr
        pad=sum(np.sin(2*np.pi*n2f(n-12)*tt)*0.5+np.sin(2*np.pi*n2f(n)*tt*1.003)*0.3 for n in ch[:3])
        env=np.minimum(1,tt/0.8)*np.minimum(1,(beat*4-tt)/0.8)
        s=int(t*sr); out[s:s+L]+=pad*env*0.035
    n=ch[[0,1,2,3,2,1,0,2][i%8]]+12
    L=int(sr*0.9); tt=np.arange(L)/sr; f=n2f(n)
    pl=(np.sin(2*np.pi*f*tt)+0.3*np.sin(4*np.pi*f*tt)+0.1*np.sin(6*np.pi*f*tt))*np.exp(-tt*5)*np.minimum(1,tt/0.005)
    s=int(t*sr); out[s:s+L]+=pl*0.09
    if i%4==0:
        L=int(sr*0.25); tt=np.arange(L)/sr; out[s:s+L]+=np.sin(2*np.pi*(50+60*np.exp(-tt*30))*tt)*np.exp(-tt*14)*0.18
    i+=1; t+=t8
d=int(sr*0.28); out[d:]+=out[:-d]*0.25
out=out[:int(sr*dur)]; out/=np.abs(out).max()*1.4
w=wave.open('/tmp/demo/music.wav','wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes((out*32767).astype(np.int16).tobytes()); w.close()
