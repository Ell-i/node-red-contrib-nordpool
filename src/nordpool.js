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

    function NordpoolNode(options) {
	RED.nodes.createNode(this, options);

	const node = this;
	node.options = options;
	node.options.fetch = {
	    'headers' : Object.assign({}, DefaultFetchHeaders, node.options.headers)
	};

	function _makeURL(baseURL) {
	    var page, start;
	    switch (node.options.period) {
	    case 'Hourly':  page += '10'; start = moment().substract(24, 'hours'); break;
	    case 'Daily':   page += '11'; start = moment().substract(30, 'days' ); break;
	    case 'Weekly':  page += '12'; start = moment().substract(52, 'weeks'); break;
	    }
	    const c = node.options.currency;
	    return baseURL + 'marketdata/page/' + page +
		'?currency=,' + c + ',' + c + ',' + c +
		'&startDate' + start.format("DD-MM-YYYY");
	}

	async function _request(msg) {
	    try {
		const url = _makeURL(msg.url || node.options.baseUrl);
		const res  = await fetch_as_JSON(url, node.options.fetch);
		const json = await res.json();
		const newMsg = Object.assign({}, msg, {
                    payload: json,
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
