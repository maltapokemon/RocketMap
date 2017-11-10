import os
import subprocess

import logging
from string import join

log = logging.getLogger(__name__)

out_dir = os.path.join('static', 'images', 'generated')
target_size = 100    # Width/height of target gym icon in pixels


def get_gym_icon(team, level, raidlevel, pkm, battle):
    init_image_dir()
    level = int(level)

    subject_lines = []
    badge_lines = []
    white_transparent = "\"rgba(255, 255, 255, 0.7)\""
    black_transparent = "\"rgba(0, 0, 0, 0.7)\""
    if pkm:
        out_filename = os.path.join(out_dir, "{}_L{}_R{}_P{}.png".format(team, level, raidlevel, pkm))
        subject_lines = draw_subject(os.path.join('static', 'sprites', '{}.png'.format(pkm)), float(2.5) / 3)
        badge_lines.extend(draw_badge(75, 20, 15, "white", "black", raidlevel))
        if level > 0:
            badge_lines.extend(draw_badge(75, 76, 15, "black", "white", level))
    elif raidlevel:
        raidlevel = int(raidlevel)
        out_filename = os.path.join(out_dir, "{}_L{}_R{}.png".format(team, level, raidlevel))
        egg_name = "legendary" if raidlevel == 5 else ("rare" if raidlevel > 2 else "normal")
        egg_size = 0.65 if raidlevel == 5 else (0.6 if raidlevel > 2 else 0.5)
        subject_lines = draw_subject(os.path.join('static', 'images', 'raid', 'egg_{}.png'.format(egg_name)), egg_size)
        badge_lines.extend(draw_badge(75, 20, 15, "white", "black", raidlevel))
        if level > 0:
            badge_lines.extend(draw_badge(75, 76, 15, "black", "white", level))
    elif battle > 0:
        out_filename = os.path.join(out_dir, '{}_L{}_B.png'.format(team, level))
        subject_lines = draw_subject(os.path.join('static', 'images', 'gym', 'Battle.png'), float(3) / 3.5)
        badge_lines.extend(draw_badge(75, 76, 15, "black", "white", level))
    elif level > 0:
        out_filename = os.path.join(out_dir, '{}_L{}.png'.format(team, level))
        badge_lines.extend(draw_badge(75, 76, 15, "black", "white", level))
    else:
        return os.path.join('static', 'images', 'gym', '{}.png'.format(team))

    if not os.path.isfile(out_filename):
        gym_image = os.path.join('static', 'images', 'gym', '{}.png'.format(team))
        font = os.path.join('static', 'SF Intellivised.ttf')
        cmd = 'convert {} {} -gravity center -font "{}" -pointsize 25 {} {}'.format(gym_image, join(subject_lines),
                                                                                    font, join(badge_lines),
                                                                                    out_filename)
        if os.name != 'nt':
            cmd = cmd.replace(" ( ", " \( ").replace(" ) ", " \) ")
        subprocess.call(cmd, shell=True)
    return out_filename


def draw_subject(image, scale):
    scaled_size = int(target_size * scale)
    lines = []
    lines.append(
        '-gravity north ( {} -resize {}x{} ( +clone -background black -shadow 80x3+5+5 ) +swap -background none -layers merge +repage ) -geometry +0+0 -composite'.format(
            image, scaled_size, scaled_size))
    return lines


def draw_badge(x, y, r, fcol, tcol, text):
    lines = []
    lines.append('-fill {} -draw "circle {},{} {},{}"'.format(fcol, x, y, x+r, y))
    lines.append('-fill {} -draw "text {},{} \'{}\'"'.format(tcol, x-47, y-44, text))
    return lines


def init_image_dir():
    if not os.path.isdir(out_dir):
        try:
            os.makedirs(out_dir)
        except OSError as exc:
            if not os.path.isdir(out_dir):
                raise
