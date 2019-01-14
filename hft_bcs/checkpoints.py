from .output import HFTEventRecord, HFTPlayerStateRecord, from_trader_to_player

def hft_trader_checkpoint(player_id, subject_state, event):
    from .models import Player
    player = Player.objects.get(player_id)
    player = from_trader_to_player(player, subject_state)
    player_record = HFTPlayerStateRecord().from_event_and_player(event, player)
    player_record.save()

def hft_event_checkpoint(event):
    event_record = HFTEventRecord().from_event(event)
    event_record.save()
