from .outbound_message_primitives import OutboundExchangeMessage, MessageFactory


class EnterOrderMessage(OutboundExchangeMessage):
    required_fields = (
        'order_token', 'buy_sell_indicator', 'price', 'time_in_force', 'firm',
        'shares', 'stock', 'exchange_host', 'exchange_port', 'delay')


class ReplaceOrderMessage(OutboundExchangeMessage):
    required_fields = (
        'existing_order_token', 'replacement_order_token', 'price', 'replace_price',
        'time_in_force', 'exchange_host', 'exchange_port', 'delay', 'shares')


class CancelOrderMessage(OutboundExchangeMessage):
    required_fields = ('order_token', 'exchange_host', 'exchange_port', 'delay', 
        'shares')


class ResetMessage(OutboundExchangeMessage):
    required_fields = ('event_code', 'timestamp', 'exchange_host', 'exchange_port',
        'delay')


class OutboundExchangeMessageFactory(MessageFactory):
    message_types = {
        'enter': EnterOrderMessage,
        'replace': ReplaceOrderMessage,
        'cancel': CancelOrderMessage,
        'reset_exchange': ResetMessage
    }