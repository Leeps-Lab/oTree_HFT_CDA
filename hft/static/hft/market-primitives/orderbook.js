
class PlayersOrderBook {

    constructor(playerId) {
        // this.polymerObject = polymerObject;
        // this.polymerPropertyName = polymerPropertyName;

        this.playerId = playerId
        this._bidPriceSlots = {};
        this._offerPriceSlots = {};
        /*
        priceSlots = {
            `price`: {
                `order_id`: `volume`,
                ...
            },
            ...
        }
        */
    }

    recv(message) {
        switch(message.type) {
            case 'confirmed':
                this._addOrder(message.price, message.buy_sell_indicator, 
                    message.order_token, message.player_id, message.time_in_force);
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

    setOrders(orders, buySellIndicator) {
        if (buySellIndicator === 'B') {
            this._bidPriceSlots = orders;
        } else if (buySellIndicator === 'S') {
            this._offerPriceSlots = orders;
        } else {console.error(`invalid buy sell indicator: ${buySellIndicator}`)}
    }

    _addOrder(price, buySellIndicator, orderToken, playerId, timeInForce=9999) {
        if (timeInForce == 0) {return ;}
        else {
        let priceSlots = this.getOrders(buySellIndicator)

        if (!priceSlots.hasOwnProperty(price)) {
            priceSlots[price] = {};
           // console.log('added price: ', price, 'orders: ', priceSlots)
        }
        priceSlots[price][orderToken] = 1;
        // console.log('added token: ', orderToken, 'orders: ', priceSlots)
        }
    }

    _removeOrder(price, buySellIndicator, orderToken, playerId) {
        let priceSlots = this.getOrders(buySellIndicator);
        if (!priceSlots.hasOwnProperty(price)) {
            console.warn(`price ${price} is not in : `, priceSlots)
        } else {
            if (!priceSlots[price].hasOwnProperty(orderToken)) {
                console.warn(`order token ${orderToken} is not in: `, priceSlots)    
            } else {
                delete priceSlots[price][orderToken]
//                console.log('delete token: ', orderToken, 'orders: ', priceSlots)
                if (Object.keys(priceSlots[price]).length == 0) {
                    delete priceSlots[price];
//                    console.log('delete price: ', price, 'orders: ', priceSlots)
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