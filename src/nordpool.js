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

        function _getPageAndStart(now, options) {
            switch (options.period) {
            case 'Hourly':  return {page:'10', start:now.subtract(24, 'hours')};
            case 'Daily':   return {page:'11', start:now.subtract(30, 'days' )};
            case 'Weekly':  return {page:'12', start:now.subtract(52, 'weeks')};
            default: throw new Error('Unknown period ' + options.period);
            }
        }

        function _makeURL(baseURL) {
            const now = moment().utc();
            const {page, start} = _getPageAndStart(now, node.options);
            const c = node.options.currency;
            return baseURL + '/marketdata/page/' + page +
                '?currency=,' + c + ',' + c + ',' + c +
                '&startDate=' + start.format("DD-MM-YYYY") +
                '&endDate='   + now.format(  "DD-MM-YYYY");
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
