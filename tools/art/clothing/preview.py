"""A moving preview for a card: one set's figure standing and walking, composed on the painted plate by stills.place. The pictures
are composed, not the engine's drawing; the cuts between clips are cuts, not turns.

  preview.py OUT.mp4 DIR --plate 13:00 --plan idle-front:3,walk-front:3,walk-left:3,walk-back:3,idle-left:2 [--walk-ms 160] [--stand-ms 250] [--speed 20]

DIR holds <clip>/f0..f3.png (a set's delivered frames). A walk clip moves the figure on the plate in the way it faces (front: toward
the viewer, left: to the left, back: away) at --speed art px a second; the camera follows it.
"""
import argparse
import os
import subprocess
import sys
import tempfile

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import compose as C  # noqa: E402
import stills  # noqa: E402

MOVE = {'front': (0, 1), 'back': (0, -1), 'left': (-1, 0), 'right': (1, 0)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('out')
    ap.add_argument('dir')
    ap.add_argument('--plate', default='13:00')
    ap.add_argument('--plan', required=True)
    ap.add_argument('--walk-ms', type=int, default=160)
    ap.add_argument('--stand-ms', type=int, default=250)
    ap.add_argument('--speed', type=float, default=20)
    ap.add_argument('--fps', type=int, default=30)
    ap.add_argument('--start', default='470,470')
    a = ap.parse_args()
    plate = C.PLATES[a.plate]
    x, y = (float(v) for v in a.start.split(','))
    tmp = tempfile.mkdtemp(prefix='cprev')
    k = 0
    for seg in a.plan.split(','):
        clip, secs = seg.split(':')
        frames = [Image.open(f'{a.dir}/{clip}/f{i}.png').convert('RGBA') for i in range(4)]
        walking = clip.startswith('walk')
        dx, dy = MOVE[clip.split('-')[1]] if walking else (0, 0)
        ms = a.walk_ms if walking else a.stand_ms
        n = int(float(secs) * a.fps)
        for j in range(n):
            t = j / a.fps
            fig = frames[int(t * 1000 // ms) % 4]
            stills.place([(fig, round(x + dx * t * a.speed), round(y + dy * t * a.speed), C.SCALE)], f'{tmp}/f{k:04d}.png', f'{tmp}/p.png', plate)
            os.remove(f'{tmp}/p.png')
            k += 1
        x, y = x + dx * float(secs) * a.speed, y + dy * float(secs) * a.speed
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(a.fps), '-i', f'{tmp}/f%04d.png', '-c:v', 'libx264',
                    '-pix_fmt', 'yuv420p', '-crf', '20', a.out], check=True)
    for f in os.listdir(tmp):
        os.remove(f'{tmp}/{f}')
    os.rmdir(tmp)
    print(a.out, k, 'frames')


if __name__ == '__main__':
    main()
