/**
 * XXX Write some documentation here
 */

module.exports = function(RED) {
    "use strict";

    const DefaultFetchHeaders = {
        'User-Agent': 'fetch',
        'Content-Type': 'application/json',
    };

    const fetch = require('node-fetch');
    const url = require('uri-js');
    const moment = require('moment');

    function NordpoolNode(options) {
        RED.nodes.createNode(this, options);

        const node = this;
        node.options = options;
        node.options.fetch = {
            'headers' : Object.assign({}, DefaultFetchHeaders, node.options.headers)
        };

        function _makeURL(baseURL) {
	    console.log(JSON.stringify(node.options));
	    const page     = node.options.page;
            const now      = moment().utc();
	    const offset   = moment.duration(node.options.start);
	    const start    = now.subtract(offset);
	    const startday = start.startOf('day');
	    const duration = moment.duration(node.options.duration);
	    const end      = start.add(duration);
	    const endday   = end.add(24, 'hours').endOf('day');
	    console.log("offset = " + offset + ", duration = " + duration +
			", start = " + start + ", end = " + end);
            const c =     node.options.currency;
            return baseURL + '/marketdata/page/' + page +
                '?currency=,' + c + ',' + c + ',' + c +
                '&startDate=' + startday.format("DD-MM-YYYY") +
                '&endDate='   + endday.format(  "DD-MM-YYYY");
        }

        function _process(json) {
            // Using [].concat for inlined flatMap, see
            // https://stackoverflow.com/questions/10865025/merge-flatten-an-array-of-arrays-in-javascript
            return [].concat.apply(
                [],
                json.data.Rows                      // An Array of rows, with Arrays of columns
                        .filter(row => !row.IsExtraRow) // Filter out extra rows
                        .map(row => {                   // Map each row to an Array of columns
                            const startTime = moment(row.StartTime, "YYYY-MM-DD\Thh:mm:ss")
                            return row.Columns
                                .filter(col => col.Name === node.options.area)    // Only wanted area
                                .map(col => { col.date = startTime; return col }); // Add date
                        })
            );
        }

        async function _request(msg) {
            try {
                const url = _makeURL(msg.url || node.options.baseUrl);
                console.log('Nordpool: Fetching URL ' + url);
                const res  = await fetch(url, node.options.fetch);
                const json = await res.json();
                const data = _process(json);
                const newMsg = Object.assign({}, msg, {
                    payload: data,
                    headers: res.headers,
                    statusCode: res.code,
                });
                node.send(newMsg);
            } catch (e) {
                console.log("Fetching failed for " + url + ":" + e);
                throw (e);
            }
        }

        this.on('input', function(msg) {
            _request(msg);
        });

        return node;
    }
    RED.nodes.registerType("nordpool", NordpoolNode);
}
