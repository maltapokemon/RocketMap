import os
import subprocess

import logging
from string import join

from pgoapi.protos.pogoprotos.map.weather.gameplay_weather_pb2 import *
from pgoapi.protos.pogoprotos.map.weather.weather_alert_pb2 import *
from pgoapi.protos.pogoprotos.networking.responses.get_map_objects_response_pb2 import *

from pogom.utils import get_args

log = logging.getLogger(__name__)

path_icons = os.path.join('static', 'sprites')
path_images = os.path.join('static', 'images')
path_gym = os.path.join(path_images, 'gym')
path_raid = os.path.join(path_images, 'raid')
path_weather = os.path.join(path_images, 'weather')
path_generated = os.path.join(path_images, 'generated')

egg_images = {
    1: 'egg_normal.png',
    2: 'egg_normal.png',
    3: 'egg_rare.png',
    4: 'egg_rare.png',
    5: 'egg_legendary.png'
}

pkm_sizes = {
    1: '50',
    2: '50',
    3: '60',
    4: '60',
    5: '80'
}

egg_sizes = {
    1: '50',
    2: '50',
    3: '55',
    4: '55',
    5: '65'
}

weather_images = {
    1: os.path.join(path_weather, 'weather_sunny.png'),
    2: os.path.join(path_weather, 'weather_rain.png'),
    3: os.path.join(path_weather, 'weather_partlycloudy_day.png'),
    4: os.path.join(path_weather, 'weather_cloudy.png'),
    5: os.path.join(path_weather, 'weather_windy.png'),
    6: os.path.join(path_weather, 'weather_snow.png'),
    7: os.path.join(path_weather, 'weather_fog.png'),
    11: os.path.join(path_weather, 'weather_clear_night.png'),
    13: os.path.join(path_weather, 'weather_partlycloudy_night.png'),
    15: os.path.join(path_weather, 'weather_moderate.png'),
    16: os.path.join(path_weather, 'weather_extreme.png')
}

def get_gym_icon(team, level, raidlevel, pkm, battle):
    init_image_dir()
    level = int(level)

    args = get_args()
    if not args.generate_images:
        return default_gym_image(team, level, raidlevel, pkm)

    subject_lines = []
    badge_lines = []
    if pkm and pkm != 'null':
        # Gym with ongoing raid
        raidlevel = int(raidlevel)
        out_filename = os.path.join(path_generated, "{}_L{}_R{}_P{}.png".format(team, level, raidlevel, pkm))
        subject_lines = draw_gym_subject(os.path.join(path_icons, '{}.png'.format(pkm)), pkm_sizes[raidlevel])
        badge_lines.extend(draw_badge(75, 20, 15, "white", "black", raidlevel))
        if level > 0:
            badge_lines.extend(draw_badge(75, 76, 15, "black", "white", level))
    elif raidlevel:
        # Gym with upcoming raid (egg)
        raidlevel = int(raidlevel)
        out_filename = os.path.join(path_generated, "{}_L{}_R{}.png".format(team, level, raidlevel))
        subject_lines = draw_gym_subject(os.path.join(path_raid, egg_images[raidlevel]), egg_sizes[raidlevel])
        badge_lines.extend(draw_badge(75, 20, 15, "white", "black", raidlevel))
        if level > 0:
            badge_lines.extend(draw_badge(75, 76, 15, "black", "white", level))
    elif level > 0:
        # Occupied gym
        out_filename = os.path.join(path_generated, '{}_L{}.png'.format(team, level))
        badge_lines.extend(draw_badge(75, 76, 15, "black", "white", level))
    else:
        # Neutral gym
        return os.path.join(path_gym, '{}.png'.format(team))

    # Battle Badge
    if battle:
        subject_lines.append('-gravity center ( {} -resize 90x90 ( +clone -background black -shadow 80x3+5+5 ) +swap -background none -layers merge +repage ) -geometry +0+0 -composite'.format(
            os.path.join(path_gym, 'battle.png')))
        out_filename = out_filename.replace('.png', '_B.png')

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

def get_pokemon_icon(pkm, weather, time):
    init_image_dir()
    args = get_args()

    im_lines = []
    # Add Pokemon icon
    if args.assets_url:
        im_lines.append(
            '-fuzz 0.5% -trim +repage'
            ' -scale 133x133\> -unsharp 0x1'
            ' -background none -gravity center -extent 139x139'
            ' -background black -alpha background -channel A -blur 0x1 -level 0,10%'
            ' -adaptive-resize 96x96'
            ' -modulate 100,110'
        )
    else:
        im_lines.append(
            ' -bordercolor none -border 2'
            ' -background black -alpha background -channel A -blur 0x1 -level 0,10%'
            ' -adaptive-resize 96x96'
            ' -modulate 100,110'
        )

    if weather:
        if time == 2:
            if not weather == 1 and weather == 3:
                weather_name = GameplayWeather.WeatherCondition.Name(int(weather))
                time_name = GetMapObjectsResponse.TimeOfDay.Name(int(time))
                out_filename = os.path.join(path_generated, "pokemon_{}_{}_{}.png".format(pkm, weather_name, time_name))
                im_lines.append(
                    '-gravity northeast'
                    ' -fill "#FFFD" -stroke black -draw "circle 74,21 74,1"'
                    ' -draw "image over 1,1 42,42 \'{}\'"'.format(weather_images[weather])
                )
            else:
                weather_name = GameplayWeather.WeatherCondition.Name(int(weather))
                time_name = GetMapObjectsResponse.TimeOfDay.Name(int(time))
                out_filename = os.path.join(path_generated, "pokemon_{}_{}_{}.png".format(pkm, weather_name, time_name))
                im_lines.append(
                    '-gravity northeast'
                    ' -fill "#FFFD" -stroke black -draw "circle 74,21 74,1"'
                    ' -draw "image over 1,1 42,42 \'{}\'"'.format(weather_images[weather + 10])
                )
        else:
            weather_name = GameplayWeather.WeatherCondition.Name(int(weather))
            time_name = GetMapObjectsResponse.TimeOfDay.Name(int(time))
            out_filename = os.path.join(path_generated, "pokemon_{}_{}_{}.png".format(pkm, weather_name, time_name))
            im_lines.append(
                '-gravity northeast'
                ' -fill "#FFFD" -stroke black -draw "circle 74,21 74,1"'
                ' -draw "image over 1,1 42,42 \'{}\'"'.format(weather_images[weather])
            )
    else:
        out_filename = os.path.join(path_generated, "pokemon_{}.png".format(pkm))

    if not os.path.isfile(out_filename):
        if args.assets_url:
            pokemon_image = '{}/decrypted_assets/pokemon_icon_{:03d}_00.png'.format(args.assets_url, pkm)
        else:
            pokemon_image = os.path.join(path_icons, '{}.png'.format(pkm))
        cmd = 'convert {} {} {}'.format(pokemon_image, join(im_lines), out_filename)
        if os.name != 'nt':
            cmd = cmd.replace(" ( ", " \( ").replace(" ) ", " \) ")
        subprocess.call(cmd, shell=True)
    return out_filename


def draw_gym_subject(image, size):
    lines = []
    lines.append(
        '-gravity north ( {} -resize {}x{} ( +clone -background black -shadow 80x3+5+5 ) +swap -background none -layers merge +repage ) -geometry +0+0 -composite'.format(
            image, size, size))
    return lines


def draw_badge(x, y, r, fill_col, text_col, text):
    lines = []
    lines.append('-fill {} -draw "circle {},{} {},{}"'.format(fill_col, x, y, x + r, y))
    lines.append('-fill {} -draw "text {},{} \'{}\'"'.format(text_col, x - 47, y - 44, text))
    return lines


def init_image_dir():
    if not os.path.isdir(path_generated):
        try:
            os.makedirs(path_generated)
        except OSError as exc:
            if not os.path.isdir(path_generated):
                raise


def default_gym_image(team, level, raidlevel, pkm):
    path = path_gym
    if pkm and pkm != 'null':
        icon = "{}_{}.png".format(team, pkm)
        path = path_raid
    elif raidlevel:
        icon = "{}_{}_{}.png".format(team, level, raidlevel)
    elif level:
        icon = "{}_{}.png".format(team, level)
    else:
        icon = "{}.png".format(team)

    return os.path.join(path, icon)
