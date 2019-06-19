import {html, PolymerElement}  from '../node_modules/@polymer/polymer/polymer-element.js';

class AttributeGraph extends PolymerElement {

    static get template() {
        return html`
            <style>
                :host {
                    display: block;
                }
                :host #svg{
                    background-color:var(--background-color-white);
                }
                .speed-line {
                    stroke: black;
                    stroke-width: 1;
                }
                .a_x-line {
                    stroke: var(--sv-color);
                    stroke-width: 2;
                }
                .a_y-line {
                    stroke:var(--inv-color);
                    stroke-width: 2;
                }
                .a_z-line {
                    stroke:var(--ef-color);
                    stroke-width: 2;
                }
                .speed-rect{
                    fill:grey;
                    opacity:0.2;
                }
                g text{
                    font-family:monospace;
                    font-size:10px;
                    font-weight: bold; 
                }
            </style>
            <svg id="svg"></svg>
        `;
    }

    static get properties() {
        return {
            speedOn: {
                type: Boolean,
                observer: '_addSpeed'
            },
            a_x: {
                type: Number,
                observer: '_addInventory'
            },
            a_y: {
                type: Number,
                observer: '_addSignedVolume'
            },
            a_z: {
                type: Number,
                observer: '_addExternalFeed'
            },
            margin: {
                type: Object,
                value: {top: 10, left: 40, right: 40, bottom: 30},
            },
            xRange: {
                type: Number,
                value: 20000,
            },
            xTimeOffset: {
                type: Number,
                value: 2000,
            },
            animationTime: {
                type: Number,
                value: 400,
            },
            _speedChangeHistory: {
                type: Array,
                value: () => [],
            },
            _inventoryHistory: {
                type: Array,
                value: () => [],
            },
            _signedVolumeHistory: {
                type: Array,
                value: () => [],
            },
            _externalFeedHistory: {
                type: Array,
                value: () => [],
            },
            _defaultYRange: {
                type: Array,
                value: [0, 1],
            },
            isRunning: {
                type: Boolean,
                value: false,
                observer: '_runningChanged'
            },
        };
    }

    static get observers() {
        return [
            '_updateInventoryLine(_inventoryHistory.splices)',
            '_updateSignedVolumeLine(_signedVolumeHistory.splices)',
            '_updateExternalFeedLine(_externalFeedHistory.splices)',
            '_updateSpeedChangeArea(_speedChangeHistory.splices)',
        ]
    }

    connectedCallback() {
        super.connectedCallback();

        window.addEventListener('resize', e => {
            this.setSize(this.offsetWidth, this.offsetHeight);
            this._updateInventoryLine();
            this._updateSignedVolumeLine();
            this._updateExternalFeedLine();
            this._updateSpeedChangeArea();
        });

        this.init();
    }

    init() {
        this.mainGroup = d3.select(this.$.svg)
            .append('g')
            .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')');
        this.rightGroup = d3.select(this.$.svg)
            .append('g')
            .attr('transform', 'translate(0,' + this.margin.top + ')');
        
        this.clipPath = this.mainGroup.append('clipPath')
            .attr('id', 'lines-clip')
            .append('rect');
        
        this.inventoryLines = this.mainGroup.append('g');
        this.signedVolumeLines = this.mainGroup.append('g');
        this.externalFeedLines = this.mainGroup.append('g');
        this.speedArea = this.mainGroup.append("g");

        this.xScale = d3.scaleTime()
            .domain([0, this.xRange]);
        
        this.xAxis = d3.axisBottom()
            .tickFormat(d3.timeFormat('%M:%S'));

        this.domXAxis = this.mainGroup.append("g")
            .attr("class", "axis axis-x");

        this.yScale = d3.scaleLinear()
            .domain(this._defaultYRange);
        
        this.yAxisLeft = d3.axisLeft()
            .tickSize(0);
        this.yAxisRight = d3.axisRight()
            .tickSize(0);

        this.domYAxisRight = this.rightGroup.append("g")
            .attr("class", "axis axis-y");
        this.domYAxisLeft = this.mainGroup.append("g")
            .attr("class", "axis axis-y");
        
        this.currentInventoryLine = this.mainGroup.append('line')
            .attr('clip-path', 'url(#lines-clip)')
            .attr('class', 'a_x-line');
        this.currentSignedVolumeLine = this.mainGroup.append('line')
            .attr('clip-path', 'url(#lines-clip)')
            .attr('class', 'a_y-line');
        this.currentExternalFeedLine = this.mainGroup.append('line')
            .attr('clip-path', 'url(#lines-clip)')
            .attr('class', 'a_z-line');
        
        this.setSize(this.offsetWidth, this.offsetHeight);
    }

    setSize(width, height) {
        this.width = width - this.margin.left - this.margin.right;
        this.height = height - this.margin.top - this.margin.bottom;

        d3.select(this.$.svg)
            .attr('width', width)
            .attr('height', height);

        this.mainGroup
            .attr('width', this.width)
            .attr('height', this.height);
        this.rightGroup
            .attr('width', this.width)
            .attr('height', this.height);
        
        this.clipPath
            .attr('width', this.width)
            .attr('height', this.height);

        this.xScale.range([0, this.width]);
        this.xAxis.scale(this.xScale);
        this.domXAxis
            .attr("transform", "translate(0," + this.height + ")")
            .call(this.xAxis);

        this.yScale.range([this.height, 5]); // Line thinning if not added a margin
        this.yAxisLeft.scale(this.yScale);
        this.yAxisRight.scale(this.yScale);

        this.domYAxisLeft.call(this.yAxisLeft);
        this.domYAxisRight
            .attr('transform', 'translate(' + (this.width + this.margin.right) + ',' + 0 + ')')
            .call(this.yAxisRight);
    }

    _runningChanged(isRunning) {
        if (isRunning) {
            this.start()
        }
    }

    start() {
        this.startTime = performance.now();

        this.xScale.domain([this.startTime, this.startTime + this.xRange]);
        this.xAxis.scale(this.xScale);
        this.domXAxis.call(this.xAxis);

        this._addInventory(this.a_x,this.a_x); 
        this._addSignedVolume(this.a_y,this.a_y); 
        this._addExternalFeed(this.a_z,this.a_z); 

        window.setInterval(function(){
        	window.requestAnimationFrame(this._tick.bind(this))
        }.bind(this)
        ,500)

    }

    _tick() {
        const now = performance.now()
        if (now > this.startTime + this.xRange) {
            this.xScale.domain([now - this.xRange, now]);
            this.xAxis.scale(this.xScale);
            this.domXAxis.call(this.xAxis);
            this._updateSpeedChangeArea();
            this._updateInventoryLine();
            this._updateExternalFeedLine();
            this._updateSignedVolumeLine();
            
        }
        if(this.speedOn){
            this.currentSpeedRect
            .attr('x', d =>  this.xScale(this._lastSpeedChangeTime))
            .attr('width', this.xScale(now) - this.xScale(this._lastSpeedChangeTime));
        }
        this.currentInventoryLine
            .attr('x1', this.xScale(this._lastInventoryChangeTime))
            .attr('x2', this.xScale(now));
        this.currentSignedVolumeLine
            .attr('x1', this.xScale(this._lastSVChangeTime))
            .attr('x2', this.xScale(now));
        this.currentExternalFeedLine
            .attr('x1', this.xScale(this._lastEFChangeTime))
            .attr('x2', this.xScale(now));
         
    }

    _addSpeed(newValue, oldValue){
        
        if (!this.mainGroup || !this.startTime) {
            return;
        }
        const self = this;
        const oldSpeedTime = this._lastSpeedChangeTime;
        this._lastSpeedChangeTime = performance.now();
        if(newValue === true){
            this.currentSpeedRect = this.mainGroup.append("rect")
                .attr("x", this.xScale(this._lastSpeedChangeTime))
                .attr("y", 0)
                .attr("width",this.xScale(this._lastSpeedChangeTime) - this.xScale(this._lastSpeedChangeTime))
                .attr("height", this.height)
                .attr("class", "speed-rect placeholder");
            
        } else if (newValue === false && oldValue === true) {
            if (this._lastSpeedChangeTime) {
                this.push('_speedChangeHistory', {time1: oldSpeedTime, time2:this._lastSpeedChangeTime});
                this._updateSpeedChangeArea();
            }   
        }
        
    }

    _addInventory(newInventory, oldInventory) {
        if (!this.mainGroup || !this.startTime) {
            return;
        }

        const oldInventoryTime = this._lastInventoryChangeTime;
        this._lastInventoryChangeTime = performance.now();
        if (this._lastInventoryChangeTime) {
            this.push('_inventoryHistory', {value1: oldInventory, value2:oldInventory, time: oldInventoryTime});
            this.push('_inventoryHistory', {value1: oldInventory, value2:newInventory, time: this._lastInventoryChangeTime}); // Vertical Lines
        }
       
        this.mainGroup.append('line')
            .attr('clip-path', 'url(#lines-clip)')
            .attr('class', 'a_x-line inv-vert')
            .attr('y1',this.yScale(oldInventory))
            .attr('y2', this.yScale(newInventory))
            .attr('x1', this.xScale(this._lastInventoryChangeTime))
            .attr('x2', this.xScale(this._lastInventoryChangeTime));

        // update current inventory line y value

        this.currentInventoryLine
            .attr('y1', this.yScale(newInventory))
            .attr('y2', this.yScale(newInventory))
            .attr('x1', this.xScale(this._lastInventoryChangeTime));
        
        
    }

    _addSignedVolume(newSV, oldSV) {
        if (!this.mainGroup || !this.startTime) {
            return;
        }

        const oldSVTime = this._lastSVChangeTime;
        this._lastSVChangeTime = performance.now();
        if (this._lastSVChangeTime) {
            this.push('_signedVolumeHistory', {value1: oldSV,value2: oldSV, time: oldSVTime});
            this.push('_signedVolumeHistory', {value1: oldSV,value2: newSV, time: this._lastSVChangeTime});
        }

        this.mainGroup.append('line')
            .attr('clip-path', 'url(#lines-clip)')
            .attr('class', 'a_y-line sv-vert')
            .attr('y1',this.yScale(oldSV))
            .attr('y2', this.yScale(newSV))
            .attr('x1', this.xScale(this._lastSVChangeTime))
            .attr('x2', this.xScale(this._lastSVChangeTime));

        // update current SV line y value
        this.currentSignedVolumeLine
            .attr('y1', this.yScale(newSV))
            .attr('y2', this.yScale(newSV))
            .attr('x1', this.xScale(this._lastSVChangeTime));
    }

    _addExternalFeed(newEF, oldEF) {
        if (!this.mainGroup || !this.startTime) {
            return;
        }

        const oldEFTime = this._lastEFChangeTime;
        this._lastEFChangeTime = performance.now();
        if (this._lastEFChangeTime) {
            this.push('_externalFeedHistory', {value1: oldEF, value2:oldEF, time: oldEFTime});
            this.push('_externalFeedHistory', {value1: oldEF, value2: newEF, time: this._lastEFChangeTime});
        }

        this.mainGroup.append('line')
            .attr('clip-path', 'url(#lines-clip)')
            .attr('class', 'a_z-line ef-vert')
            .attr('y1',this.yScale(oldEF))
            .attr('y2', this.yScale(newEF))
            .attr('x1', this.xScale(this._lastEFChangeTime))
            .attr('x2', this.xScale(this._lastEFChangeTime));

        // update current EF line y value
        this.currentExternalFeedLine
            .attr('y1', this.yScale(newEF))
            .attr('y2', this.yScale(newEF))
            .attr('x1', this.xScale(this._lastEFChangeTime));
    }

    _updateSpeedChangeArea(){
        if (!this.mainGroup || !this.startTime) {
            return;
        }
        const self = this;
        const speedHistory = this.get('_speedChangeHistory');
        const speedArea = this.mainGroup
            .selectAll('.speed-rect')
            .data(speedHistory);
        this.mainGroup.selectAll('.placeholder').remove()

        speedArea.enter()
            .append('rect')
            .attr('class', 'speed-rect')
            .attr('x', d =>  self.xScale(d.time1))
            .attr('y', 0)
            .attr('width', d => self.xScale(d.time2) - self.xScale(d.time1))
            .attr('height', self.height);
        speedArea
            .attr('x', d =>  self.xScale(d.time1))
            .attr('width', d => self.xScale(d.time2) - self.xScale(d.time1))
    }

    _updateInventoryLine() {
        if (!this.mainGroup || !this.startTime) {
            return;
        }

        const self = this;
        const inventoryHistory = this.get('_inventoryHistory');
        
        const lines = this.inventoryLines.selectAll('line')
            .data(inventoryHistory);
        this.mainGroup.selectAll('.inv-vert').remove()
        lines.enter()
            .append('line')
            .attr('clip-path', 'url(#lines-clip)')
            .attr('class', 'a_x-line')
            .attr('x1', d =>  self.xScale(d.time))
            .attr('x2', (_, i) => self.xScale(i == inventoryHistory.length-1 ? self._lastInventoryChangeTime : inventoryHistory[i+1].time))
            .attr('y1', d => self.yScale(d.value1))
            .attr('y2', d => self.yScale(d.value2));

        lines
            .attr('x1', d =>  self.xScale(d.time))
            .attr('x2', (_, i) => self.xScale(i == inventoryHistory.length-1 ? self._lastInventoryChangeTime : inventoryHistory[i+1].time))
    }

    _updateSignedVolumeLine() {
        if (!this.mainGroup || !this.startTime) {
            return;
        }

        const self = this;
        const signedVolumeHistory = this.get('_signedVolumeHistory');

        const lines = this.signedVolumeLines.selectAll('line')
            .data(signedVolumeHistory);
        this.mainGroup.selectAll('.sv-vert').remove()
        lines.enter()
            .append('line')
            .attr('clip-path', 'url(#lines-clip)')
            .attr('class', 'a_y-line')
            .attr('x1', d =>  self.xScale(d.time))
            .attr('x2', (_, i) => self.xScale(i == signedVolumeHistory.length-1 ? self._lastSVChangeTime : signedVolumeHistory[i+1].time))
            .attr('y1', d => self.yScale(d.value1))
            .attr('y2', d => self.yScale(d.value2));

        lines
            .attr('x1', d =>  self.xScale(d.time))
            .attr('x2', (_, i) => self.xScale(i == signedVolumeHistory.length-1 ? self._lastSVChangeTime : signedVolumeHistory[i+1].time))
    }

    _updateExternalFeedLine() {
        if (!this.mainGroup || !this.startTime) {
            return;
        }

        const self = this;
        const externalFeedHistory = this.get('_externalFeedHistory');
        const lines = this.externalFeedLines.selectAll('line')
            .data(externalFeedHistory);
        this.mainGroup.selectAll('.ef-vert').remove()
        lines.enter()
            .append('line')
            .attr('clip-path', 'url(#lines-clip)')
            .attr('class', 'a_z-line')
            .attr('x1', d =>  self.xScale(d.time))
            .attr('x2', (_, i) => self.xScale(i == externalFeedHistory.length-1 ? self._lastEFChangeTime : externalFeedHistory[i+1].time))
            .attr('y1', d => self.yScale(d.value1))
            .attr('y2', d => self.yScale(d.value2));

        lines
            .attr('x1', d =>  self.xScale(d.time))
            .attr('x2', (_, i) => self.xScale(i == externalFeedHistory.length-1 ? self._lastEFChangeTime : externalFeedHistory[i+1].time))
    }

}

window.customElements.define('attribute-graph', AttributeGraph);
