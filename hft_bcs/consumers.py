from channels import Group, Channel
from channels.generic.websockets import JsonWebsocketConsumer
from .models import (Constants, Player, Group as OGroup )
from .client_messages import broadcast
import json
import logging
from django.core.cache import cache
from .decorators import timer
from .event_handlers import (receive_trader_message, receive_market_message,
    process_response)
from .exogenous_events import *
from . import utility

from .dispatcher import LEEPSDispatcher

log = logging.getLogger(__name__)

class SubjectConsumer(JsonWebsocketConsumer):

    def raw_connect(self, message, group_id, player_id):
        Group(group_id).add(message.reply_channel)
        self.connect(message, group_id, player_id)

    def connect(self, message, group_id, player_id):
        player = Player.objects.get(id=player_id)
        log.info('Player %s is connected to Group %s with in-group id %s.' % (
            player_id, group_id, player.id_in_group))
        player.channel = message.reply_channel
        player.save()

    @timer
    def raw_receive(self, message, group_id, player_id):
        try:
            LEEPSDispatcher('websocket', message, group_id=group_id,
                player_id=player_id)
        except Exception as e:
            log.exception('player %s: error processing message, ignoring. %s:%s', player_id, message_content, e)

    def raw_disconnect(self, message, group_id, player_id):
        log.info('Player %s disconnected from Group %s.' % (player_id, group_id))
        Group(group_id).discard(message.reply_channel)
        
class InvestorConsumer(JsonWebsocketConsumer):

    def raw_receive(self, message):
        LEEPSDispatcher('websocket', message)

class JumpConsumer(JsonWebsocketConsumer):

    def raw_receive(self, message):
        LEEPSDispatcher('websocket', message)