#!/usr/bin/python
# -*- coding: utf-8 -*-

import logging
import random
import time
from matplotlib.path import Path
from ast import literal_eval

from pgoapi.protos.pogoprotos.inventory.item.item_id_pb2 import *

from pogom.account import log, spin_pokestop_request, \
    encounter_pokemon_request, pokestop_spinnable, clear_inventory_request, \
    lure_pokestop_request
from pogom.utils import get_pokemon_name

log = logging.getLogger(__name__)


# Drop this many balls at once
DROP_BALLS = 50

# These Pokemon could be Dittos
DITTO_CANDIDATES_IDS = [16, 19, 41, 161, 163, 193]

DITTO_POKEDEX_ID = 132

ITEM_NAMES = {
    ITEM_POKE_BALL: u"Poké Ball",
    ITEM_GREAT_BALL: u"Great Ball",
    ITEM_ULTRA_BALL: u"Ultra Ball",
    ITEM_POTION: u"Potion",
    ITEM_SUPER_POTION: u"Super Potion",
    ITEM_HYPER_POTION: u"Hyper Potion",
    ITEM_MAX_POTION: u"Max Potion",
    ITEM_REVIVE: u"Revive",
    ITEM_MAX_REVIVE: u"Max Revive",
    ITEM_BLUK_BERRY: u"Bluk Berry",
    ITEM_NANAB_BERRY: u"Nanab Berry",
    ITEM_WEPAR_BERRY: u"Wepar Berry",
    ITEM_PINAP_BERRY: u"Pinap Berry",
    ITEM_RAZZ_BERRY: u"Razz Berry"
}


def gxp_spin_stops(forts, pgacc, step_location):
    for f in forts:
        if f.type == 1 and pokestop_spinnable(f, step_location):
            time.sleep(random.uniform(0.8, 1.8))
            response = spin_pokestop_request(pgacc, f, step_location)
            time.sleep(random.uniform(2, 4))  # Don't let Niantic throttle.

            # Check for reCaptcha.
            if pgacc.has_captcha():
                log.debug('Account encountered a reCaptcha.')
                return

            spin_result = response['FORT_SEARCH'].result
            if spin_result is 1:
                awards = parse_awarded_items(response['FORT_SEARCH'].items_awarded)
                log.info('GXP: Got {} items ({} balls) from Pokestop.'.format(awards['total'], awards['balls']))
                cleanup_inventory(pgacc)
                return True
            elif spin_result is 2:
                log.debug('GXP: Pokestop was not in range to spin.')
            elif spin_result is 3:
                log.debug('GXP: Failed to spin Pokestop. Has recently been spun.')
            elif spin_result is 4:
                log.debug('GXP: Failed to spin Pokestop. Inventory is full.')
                cleanup_inventory(pgacc)
            elif spin_result is 5:
                log.debug('GXP: Maximum number of Pokestops spun for this day.')
            else:
                log.debug(
                    'GXP: Failed to spin a Pokestop. Unknown result %d.',
                    spin_result)


def is_ditto(args, pgacc, p):
    pokemon_id = p.pokemon_data.pokemon_id
    pokemon_name = get_pokemon_name(pokemon_id)

    log.info(u'{} may be a Ditto. Triggering catch logic!'.format(pokemon_name))

    # Encounter Pokemon.
    time.sleep(args.encounter_delay)
    encounter_pokemon_request(pgacc, p.encounter_id,
                              p.spawn_point_id,
                              [p.latitude, p.longitude])

    # Now try to catch it.
    got_ditto = False
    catch_result = catch(pgacc, p.encounter_id, p.spawn_point_id)
    if catch_result['catch_status'] == 'success':
        if int(catch_result['pid']) == DITTO_POKEDEX_ID:
            logmsg = u'GXP: Successfully caught a Ditto disguised as {}! Needed {} attempts.'
            captured_pokemon_name = get_pokemon_name(DITTO_POKEDEX_ID)
            got_ditto = True
        else:
            logmsg = u'GXP: Successfully caught a regular {} after {} attempts.'
        log.info(logmsg.format(pokemon_name, catch_result['attempts']))
    else:
        log.info("GXP: Failed catching {}: {} Attempts: {}".format(pokemon_name, catch_result['reason'], catch_result['attempts']))
    return got_ditto


def catch(pgacc, encounter_id, spawn_point_id):
    # Try to catch pokemon, but don't get stuck.
    rv = {
        'catch_status': 'fail',
        'reason': "Unknown reason.",
        'attempts': 1
    }
    while rv['attempts'] < 3 and pgacc.inventory_balls > 0:
        time.sleep(random.uniform(2, 3))
        try:
            # Randomize throwing parameters. Some stuff to read:
            # https://pokemongo.gamepress.gg/catch-mechanics
            # https://www.reddit.com/r/pokemongodev/comments/4vlnwj/pokemon_go_catch_mechanicsformula_discussion/
            normalized_reticle_size = 1.1 + 0.70 * random.random()
            spin_modifier = 0.4 + 0.4 * random.random()

            # Determine best ball - we know for sure that we have at least one
            inventory = pgacc.inventory
            ball = ITEM_ULTRA_BALL if inventory.get(ITEM_ULTRA_BALL, 0) > 0 else (
                ITEM_GREAT_BALL if inventory.get(ITEM_GREAT_BALL, 0) > 0 else ITEM_POKE_BALL)

            catch_result = pgacc.req_catch_pokemon(
                encounter_id,
                spawn_point_id,
                ball,
                normalized_reticle_size,
                spin_modifier)

            if (catch_result is not None and 'CATCH_POKEMON' in catch_result):
                catch_status = catch_result['CATCH_POKEMON'].status

                # Success!
                if catch_status == 1:
                    rv['catch_status'] = 'success'
                    if pgacc.last_caught_pokemon:
                        # Set ID of caught Pokemon
                        rv['pid'] = pgacc.last_caught_pokemon['pokemon_id']
                    return rv

                # Broke free!
                if catch_status == 2:
                    log.debug('GXP: Catch attempt %s failed. It broke free!', rv['attempts'])

                # Ran away!
                if catch_status == 3:
                    rv['reason'] = "Pokemon ran away!"
                    return rv

                # Dodged!
                if catch_status == 4:
                    log.debug('GXP: Catch attempt %s failed. It dodged the ball!', rv['attempts'])

            else:
                log.error('GXP: Catch attempt %s failed. The api response was empty!', rv['attempts'])

        except Exception as e:
            log.error('GXP: Catch attempt %s failed. API exception: %s', rv['attempts'], repr(e))

        rv['attempts'] += 1

    if rv['attempts'] >= 3:
        rv['attempts'] -= 1
        rv['reason'] = "Giving up."

    return rv


def parse_awarded_items(items_awarded):
    awards = {}
    total = 0
    balls = 0
    for item in items_awarded:
        item_id = item.item_id
        count = item.item_count
        total += count
        if item_id in (ITEM_POKE_BALL, ITEM_GREAT_BALL, ITEM_ULTRA_BALL, ITEM_MASTER_BALL):
            balls += count
        awards[item_id] = awards.get(item_id, 0) + count
    awards['total'] = total
    awards['balls'] = balls
    return awards


def cleanup_inventory(pgacc):
    drop_stats = {}
    # Just need to make room for at least one more item
    if pgacc.inventory_total >= 350:
        drop_items(pgacc, ITEM_POTION, drop_stats)
        drop_items(pgacc, ITEM_SUPER_POTION, drop_stats)
        drop_items(pgacc, ITEM_HYPER_POTION, drop_stats)
        drop_items(pgacc, ITEM_MAX_POTION, drop_stats)
        drop_items(pgacc, ITEM_REVIVE, drop_stats)
        drop_items(pgacc, ITEM_MAX_REVIVE, drop_stats)
        drop_items(pgacc, ITEM_BLUK_BERRY, drop_stats)
        drop_items(pgacc, ITEM_NANAB_BERRY, drop_stats)
        drop_items(pgacc, ITEM_WEPAR_BERRY, drop_stats)
        drop_items(pgacc, ITEM_PINAP_BERRY, drop_stats)
        drop_items(pgacc, ITEM_RAZZ_BERRY, drop_stats)

        # Throw away balls if necessary
        if pgacc.inventory_total >= 350:
            need_to_drop = pgacc.inventory_total - 350 + DROP_BALLS
            items_dropped = drop_items(pgacc, ITEM_POKE_BALL, drop_stats, need_to_drop)
            if items_dropped < need_to_drop:
                need_to_drop -= items_dropped
                items_dropped = drop_items(pgacc, ITEM_GREAT_BALL, drop_stats, need_to_drop)
                if items_dropped < need_to_drop:
                    need_to_drop -= items_dropped
                    drop_items(pgacc, ITEM_ULTRA_BALL, drop_stats, need_to_drop)

        # Log what was dropped
        drops = []
        for item_id in sorted(drop_stats):
            dropped = drop_stats[item_id]
            drops.append(u"{} {}s".format(dropped, ITEM_NAMES[item_id]))
        log.info(u"GXP: Items dropped: {}".format(u", ".join(drops)))


def drop_items(pgacc, item_id, drop_stats, drop_count=-1):
    item_count = pgacc.inventory.get(item_id, 0)
    drop_count = item_count if drop_count == -1 else min(item_count, drop_count)
    if drop_count > 0:
        time.sleep(random.uniform(2, 4))
        result = clear_inventory_request(pgacc, item_id, drop_count)['RECYCLE_INVENTORY_ITEM'].result
        if result == 1:
            drop_stats[item_id] = drop_count
            return drop_count
        else:
            log.warning(u"GXP: Failed dropping {} {}s.".format(drop_count, ITEM_NAMES[item_id]))
    return 0

def lure_pokestop(args, pgacc, fort, step_location):
    if len(fort.active_fort_modifier) == 0:
        lures = pgacc.inventory_lures
        lure_result = None
        modifier = 501
        if args.lureFence is not None:
            allowed = lure_geofence(step_location, args.lureFence)
            if allowed == []:
                forbidden = True
            else:
                forbidden = False
        if args.nolureFence is not None:
            forbidden = lure_geofence(step_location, args.nolureFence, forbidden=True)
            if forbidden == []:
                forbidden = False
            else:
                forbidden = True
        if lures == 0:
            forbidden = True
        while lure_result is None and lures > 0:
            lure_response = lure_pokestop_request(pgacc, modifier, fort, step_location)
            # Check for Captcha
            if pgacc.has_captcha():
                log.debug('Account encountered a reCaptcha.')
                return False
            lure_result = lure_response['ADD_FORT_MODIFIER'].result
            if lure_result is 0:
                log.warning('Lure unset!')
            elif lure_result is 1:
                log.warning('Lure Successfully Set!')
            elif lure_result is 2:
                log.warning('Stop already has lure!')
            elif lure_result is 3:
                log.warning('Out of range to set lure!')
            elif lure_result is 4:
                log.warning('Account has no lures!')
            else:
                log.debug(
                    'Failed to lure a Pokestop. Unknown result %d.',
                    lure_result)
            return False

# Need to Modifiy this to possible use built in geofence stuff (WIP)
def lure_geofence(results, geofence_file, forbidden=False):
    geofence = []
    with open(geofence_file) as f:
        for line in f:
            if len(line.strip()) == 0 or line.startswith('#'):
                continue
            geofence.append(literal_eval(line.strip()))
        if forbidden:
            log.info('Loaded %d geofence-forbidden coordinates. ' +
                     'Applying...', len(geofence))
        else:
            log.info('Loaded %d geofence coordinates. Applying...',
                     len(geofence))
    log.info(geofence)
    p = Path(geofence)
    results_geofenced = []
    for g in range(len(results)):
        result_x, result_y, result_z = results[g]
        if p.contains_point([result_x, result_y]) ^ forbidden:
            results_geofenced.append((result_x, result_y, result_z))
    return results_geofenced
