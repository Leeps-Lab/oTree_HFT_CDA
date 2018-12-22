from .cache import get_cache_key, write_to_cache_with_version, cache_timeout,
    get_players_by_market
from . import utility
from .translator import LeepsOuchTranslator
from .subject_state import BCSSubjectState
from .trader import CDATraderFactory, FBATraderFactory
from .exchange import send_exchange
from . import client_messages 
from django.core.cache import cache
from .decorators import atomic
from random import shuffle


trader_factory_map = {
        'CDA': CDATraderFactory, 'FBA': FBATraderFactory
    }

SUBPROCESSES = {}

class HandlerFactory:

    @staticmethod
    def get_handler(handler_type):
        if handler_type == 'trader':
            return leeps_handle_trader_message
        elif handler_type == 'market':
            return leeps_handle_market_message
        elif handler_type == 'trade_session':
            return leeps_handle_session_events
        elif handler_type == 'fundamental_price_change':
            return fundamental_price_change
        elif handler_type == 'noise_trader_arrival':
            return noise_trader_arrival

def leeps_handle_trader_message(event, session_format='CDA', **kwargs):
    player_id = event.attachments.get('player_id')
    key = get_cache_key(player_id ,'trader')
    trader_data = cache.get(key)
    if event.event_type == 'role_change':
        # temporary for testing.
        trader_data['role'] = event.attachments.get('state').lower()
    role_name, subject_state = trader_data['role'], trader_data['subject_state']
    TraderFactory = trader_factory_map[session_format]
    trader = TraderFactory.get_trader(role_name, subject_state)
    trader.receive(event.event_type, **kwargs)
    message_queue = trader.outgoing_messages.copy()
    trader.outgoing_messages.clear()
    event.outgoing_messages.extend(message_queue)
    trader_data['subject_state'] = BCSSubjectState.from_trader(trader)
    version = trader_data['version'] + 1
    try:
        write_to_cache_with_version(key, trader_data, version)
    except ValueError:
        leeps_handle_trader_message(event, **kwargs)
    else:
        return event

def leeps_handle_market_message(event, **kwargs):
    market_id = event.attachments.get('market_id')
    market_key = get_cache_key(market_id, 'market')
    market_data = cache.get(market_key)
    market, version = market_data['market'], market_data['version']
    market.receive(event, **kwargs)
    message_queue = market.outgoing_messages.copy()
    market.outgoing_messages.clear()
    event.outgoing_messages.extend(message_queue)
    market_data['market'] = market
    version = market_data['version'] + 1
    try:
        write_to_cache_with_version(market_key, market_data, version)
    except ValueError:
        leeps_handle_market_message(event, **kwargs)
    else:
        return event

@atomic
def leeps_handle_session_events(event, **kwargs):
    message_type, market_id = event.event_type, event.message['market_id']
    session_id = event.message['session_id']
    session_key = get_cache_key(session_id, 'trade_session')
    trade_session = cache.get(session_key)
    if trade_session.id not in SUBPROCESSES:
        SUBPROCESSES[trade_session.id] = {}
    trade_session.clients = SUBPROCESSES[trade_session.id]         
    trade_session.receive(message_type, market_id)
    SUBPROCESSES[trade_session.id] = trade_session.clients
    trade_session.clients = {}
    message_queue = trade_session.outgoing_messages.copy()
    trade_session.outgoing_messages.clear()
    event.outgoing_messages.extend(message_queue)    
    cache.set(session_key, trade_session, timeout=cache_timeout)
    return event

def fundamental_price_change(event, **kwargs):
    market_id = str(event.attachments.pop('market_id'))
    all_players_data = get_players_by_market(market_id)
    for player_data in all_players_data:
        player = player_data['model']
        event.attachments['player_id'] = player.id
        event = leeps_handle_trader_message(event, **kwargs)
    shuffle(event.outgoing_messages)
    event = leeps_handle_market_message(event, **kwargs)
    return event

integer_fields = ('price', 'time_in_force')
def noise_trader_arrival(event, **kwargs):
    market_id = str(event.attachments.pop('market_id'))
    event.attachments['price'] = int(event.attachments['price'] )
    event.attachments['time_in_force'] = int(event.attachments['time_in_force'])
    event = leeps_handle_market_message(event, **kwargs)
    return event

# def leeps_handle_exchange_message(event, **kwargs):
#     def extract_player_id(**kwargs):
#         token = kwargs.get('order_token')
#         if token is None:
#             token = kwargs.get('replacement_order_token')
#         # index 3 is subject ID      
#         player_id = token[5:9]
#         if token[3] == '@':
#             #   way out for investor orders
#             return False
#         return player_id
#     message_type, fields = LeepsOuchTranslator.decode(message)
#     fields['type'] = message_type
#     print('\nINCOMING: %s\n' % fields)
#     if message_type in utility.trader_events:
#         player_id = extract_player_id(**fields)
#         if player_id is not False:
#             message_queue = receive_trader_message(player_id, message_type, **fields)
#             process_response(message_queue)
#     if message_type in utility.market_events:
#         market_message_queue = receive_market_message(market_id, message_type, **fields)
#         process_response(market_message_queue)
    
