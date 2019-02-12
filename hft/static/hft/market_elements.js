
class PlayersOrderBook {

    constructor(playerId) {
        this.playerId = playerId
        this._bidPriceSlots = {};
        this._offerPriceSlots = {};
    }

    recv(message) {
        switch(message.type) {
            case 'confirmed':
                this._addOrder(message.price, message.buy_sell_indicator, 
                    message.order_token, message.player_id);
                break;
            case 'executed':
            case 'canceled':
                this._removeOrder(message.price, message.buy_sell_indicator, 
                    message.order_token, message.player_id);
                break;
            case 'replaced':
                this._replaceOrder(message.price, message.buy_sell_indicator, 
                    message.order_token, message.player_id, message.old_price,
                    message.old_token)
                break;
        }
    }
    
    getOrders(buySellIndicator) {
        if (buySellIndicator === 'B') {
            return this._bidPriceSlots;
        } else if (buySellIndicator === 'S') {
            return this._offerPriceSlots;
        } else {console.error(`invalid buy sell indicator: ${buySellIndicator}`)}
    }

    _addOrder(price, buySellIndicator, orderToken, playerId) {
        let priceSlots = this.getOrders(buySellIndicator)

        if (!priceSlots.hasOwnProperty(price)) {
            priceSlots[price] = {};
        }
        priceSlots[price][orderToken] = 1;
    }

    _removeOrder(price, buySellIndicator, orderToken, playerId) {
        let priceSlots = this.getOrders(buySellIndicator);
        if (!priceSlots.hasOwnProperty(price)) {
            console.error(`price ${price} is not in ${priceSlots}`)
        } else {
            if (!priceSlots[price].hasOwnProperty(orderToken)) {
                console.error(`order token ${orderToken} is not in ${priceSlots}`)    
            } else {
                delete priceSlots[price][orderToken]
                if (Object.keys(priceSlots[price]).length == 0) {
                    delete priceSlots[price];
                }
            }
        }

    }

    _replaceOrder(price, buySellIndicator, orderToken, playerId, oldPrice, oldToken) {
        this._removeOrder(oldPrice, buySellIndicator, oldToken, playerId);
        this._addOrder(price, buySellIndicator,  orderToken, playerId);
    }
}

export {PlayersOrderBook};