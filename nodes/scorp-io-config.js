module.exports = function(RED) {
    const mqtt = require('mqtt');

    function ScorpIoConfigNode(config) {
        RED.nodes.createNode(this, config);

        this.clientId   = config.clientId;
        this.projectId  = config.projectId;
        this.edgeNodeId = config.edgeNodeId;
        this.mode       = config.mode || 'test';
        this.login      = config.login;
        this.password   = this.credentials && this.credentials.password;
        this.brokerUrl  = 'mqtts://broker-public-prod.scorp-io.com:8883';

        this._devices   = {};
        this.connected  = false;

        const node = this;

        // ── API partagée — toujours définie, mode test ou production ──────────

        node.register = function(deviceNode) {
            node._devices[deviceNode.id] = deviceNode;
        };

        node.deregister = function(deviceNode) {
            delete node._devices[deviceNode.id];
        };

        node.publish = function(topic, payload, options, callback) {
            // Compatibilité : publish(topic, payload, callback)
            if (typeof options === 'function') { callback = options; options = {}; }
            options = options || {};

            if (node.mode === 'test') {
                if (callback) callback(null);
                return;
            }
            if (node.client && node.client.connected) {
                const mqttOpts = { qos: 1, retain: !!options.retain };
                node.client.publish(topic, JSON.stringify(payload), mqttOpts, callback);
            } else {
                node.warn('SCorp-io : tentative de publication hors connexion');
                if (callback) callback(new Error('Non connecté'));
            }
        };

        // ── Connexion MQTT — uniquement en mode production ────────────────────

        if (node.mode === 'test') {
            node.log('[MODE TEST] Connexion MQTT désactivée');
            return;
        }

        const options = {
            clientId:           node.clientId,
            username:           node.login,
            password:           node.password,
            rejectUnauthorized: true,
            reconnectPeriod:    5000,
            connectTimeout:     30000
        };

        node.client = mqtt.connect(node.brokerUrl, options);

        node.client.on('connect', function() {
            node.connected = true;
            node.log('SCorp-io connecté à ' + node.brokerUrl);
            Object.values(node._devices).forEach(d => d.onConnected());
        });

        node.client.on('reconnect', function() {
            node.connected = false;
            node.log('SCorp-io reconnexion en cours...');
            Object.values(node._devices).forEach(d => d.onConnecting());
        });

        node.client.on('error', function(err) {
            node.connected = false;
            node.error('SCorp-io erreur MQTT : ' + err.message);
            Object.values(node._devices).forEach(d => d.onError(err.message));
        });

        node.client.on('offline', function() {
            node.connected = false;
            node.log('SCorp-io déconnecté');
            Object.values(node._devices).forEach(d => d.onDisconnected());
        });

        node.on('close', function(done) {
            if (node.client) {
                node.client.end(true, {}, done);
            } else {
                done();
            }
        });
    }

    RED.nodes.registerType('scorp-io-config', ScorpIoConfigNode, {
        credentials: {
            password: { type: 'password' }
        }
    });
};
