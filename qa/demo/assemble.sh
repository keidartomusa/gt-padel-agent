set -e
cd /tmp/demo; rm -rf seg; mkdir seg
mapfile -t F < <(grep -o "file '[^']*'" frames/list.txt | sed "s/file '//;s/'$//")
mapfile -t D < <(grep -o "duration [0-9.]*" frames/list.txt | cut -d' ' -f2)
N=${#D[@]}; : > seg/list.txt
for ((i=0;i<N;i++)); do o=seg/s$(printf %03d $i).mp4
 if [ $i -eq 0 ]; then ffmpeg -loglevel error -y -loop 1 -framerate 30 -t ${D[0]} -i ${F[0]} -vf "scale=1080:1920,format=yuv420p" -c:v libx264 -preset veryfast -crf 22 -r 30 $o
 else ffmpeg -loglevel error -y -loop 1 -framerate 30 -t 1 -i ${F[$((i-1))]} -loop 1 -framerate 30 -t ${D[$i]} -i ${F[$i]} -filter_complex "[0]scale=1080:1920,fps=30,format=yuv420p[a];[1]scale=1080:1920,fps=30,format=yuv420p[b];[a][b]xfade=transition=fade:duration=0.3:offset=0.01,trim=duration=${D[$i]}" -c:v libx264 -preset veryfast -crf 22 -r 30 $o; fi
 echo "file '$PWD/$o'" >> seg/list.txt; done
T=$(python3 -c "print(sum(map(float,'${D[*]}'.split())))")
python3 music.py $T
ffmpeg -loglevel error -y -f concat -safe 0 -i seg/list.txt -i music.wav -filter_complex "[1:a]afade=t=in:d=1.5,afade=t=out:st=$(python3 -c "print($T-2.5)"):d=2.5[a]" -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 128k -shortest /downloads/gt-padel-demo-v2.mp4
echo done $N $T
