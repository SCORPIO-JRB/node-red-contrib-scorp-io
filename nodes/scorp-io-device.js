module.exports = function(RED) {

    // ── resolvePath ───────────────────────────────────────────────────────────
    // Résout un chemin depuis la racine msg
    //   "msg.payload.pompe1.etats" → msg.payload.pompe1.etats
    //   "msg.pompe.etat"           → msg.pompe.etat
    //   "pompe1.etats"             → fallback sur msg.payload.pompe1.etats

    function resolvePath(msg, rawPath) {
        if (!rawPath || !msg) return undefined;
        let path = rawPath.trim();
        if (path.startsWith('msg.')) {
            path = path.slice(4);
        } else {
            path = 'payload.' + path;
        }
        try {
            return path.split('.').reduce(function(acc, key) {
                if (acc === undefined || acc === null) return undefined;
                return acc[key];
            }, msg);
        } catch(e) { return undefined; }
    }

    // ── deviceIsRelevant ──────────────────────────────────────────────────────
    // Retourne true si au moins une métrique du device est résolvable dans msg

    function deviceIsRelevant(device, msg) {
        return device.metrics.some(function(m) {
            return m.valuePath && resolvePath(msg, m.valuePath) !== undefined;
        });
    }

    // ── buildTopic ────────────────────────────────────────────────────────────

    function buildTopic(projectId, edgeNodeId, deviceId, msgType) {
        return ['mqtts', projectId, msgType, edgeNodeId, deviceId].join('/');
    }

    // ── ScorpIoDeviceNode ─────────────────────────────────────────────────────

    function ScorpIoDeviceNode(config) {
        RED.nodes.createNode(this, config);

        this.devices        = config.devices || [];
        this.birthOnDeploy  = config.birthOnDeploy !== false; // true par défaut
        this.birthPeriodic  = !!config.birthPeriodic;
        this.birthInterval  = config.birthInterval || '24h';
        this.configId       = config.config;
        this.config         = RED.nodes.getNode(this.configId);

        const node   = this;
        const isTest = !node.config || node.config.mode === 'test';

        if (!node.config) {
            node.status({ fill: 'red', shape: 'ring', text: 'Config manquante' });
            node.error('Nœud de configuration SCorp-io introuvable');
            return;
        }

        // ── Constructeurs de payload ──────────────────────────────────────────

        function buildDBirth(device) {
            return {
                metrics: device.metrics.map(m => ({
                    name:     m.name,
                    dataType: m.dataType
                }))
            };
        }

        function buildDData(device, msg) {
            return {
                metrics: device.metrics.map(function(m) {
                    const value     = resolvePath(msg, m.valuePath);
                    const timestamp = Date.now();
                    if (value === undefined && m.valuePath) {
                        node.warn(
                            '[' + device.deviceId + '] Métrique "' + m.name + '" : ' +
                            'chemin "' + m.valuePath + '" introuvable dans msg.'
                        );
                    }
                    return { name: m.name, timestamp: timestamp, dataType: m.dataType, value: value };
                })
            };
        }

        // ── Debug output ──────────────────────────────────────────────────────

        function emitDebug(msgType, deviceId, topic, payload) {
            node.send([{
                topic:   topic,
                payload: payload,
                _scorp: {
                    type:      msgType,
                    mode:      node.config.mode,
                    device:    deviceId,
                    simulated: isTest
                }
            }]);
        }

        // ── Publication DBIRTH (1 device) ─────────────────────────────────────

        function sendBirthForDevice(device) {
            const topic   = buildTopic(node.config.projectId, node.config.edgeNodeId, device.deviceId, 'DBIRTH');
            const payload = buildDBirth(device);

            node.log('DBIRTH [' + device.deviceId + '] → ' + topic);

            if (isTest) {
                emitDebug('DBIRTH', device.deviceId, topic, payload);
                return;
            }

            node.config.publish(topic, payload, { retain: true }, function(err) {
                if (err) {
                    node.error('Erreur DBIRTH [' + device.deviceId + '] : ' + err.message);
                } else {
                    node.log('DBIRTH [' + device.deviceId + '] publié');
                    emitDebug('DBIRTH', device.deviceId, topic, payload);
                }
            });
        }

        // ── Publication DBIRTH (tous les devices) ─────────────────────────────

        node.sendAllBirths = function() {
            if (node.devices.length === 0) {
                node.warn('Aucun device configuré, DBIRTH ignoré');
                return;
            }
            node.devices.forEach(sendBirthForDevice);

            if (isTest) {
                node.status({ fill: 'blue', shape: 'ring', text: '🧪 DBIRTH x' + node.devices.length + ' simulé' });
            } else {
                node.status({ fill: 'green', shape: 'dot', text: 'DBIRTH x' + node.devices.length + ' envoyé' });
            }
        };

        // ── Publication DDATA — routage automatique par correspondance ─────────
        // Pour chaque device, on vérifie si au moins une métrique est résolvable
        // dans le msg. Si oui → DDATA publié pour ce device.
        // Si aucun device matche → warn.

        node.sendDataAuto = function(msg) {
            const matched = node.devices.filter(d => deviceIsRelevant(d, msg));

            if (matched.length === 0) {
                node.warn(
                    'Aucun device ne correspond au msg reçu. ' +
                    'Vérifier les chemins de métriques configurés. ' +
                    'msg.payload : ' + JSON.stringify(msg.payload)
                );
                return;
            }

            matched.forEach(function(device) {
                const topic = buildTopic(node.config.projectId, node.config.edgeNodeId, device.deviceId, 'DDATA');
                const data  = buildDData(device, msg);

                node.log('DDATA [' + device.deviceId + '] → ' + topic);

                if (isTest) {
                    node.status({ fill: 'blue', shape: 'dot', text: '🧪 DDATA [' + device.deviceId + '] simulé' });
                    emitDebug('DDATA', device.deviceId, topic, data);
                    return;
                }

                node.config.publish(topic, data, { retain: false }, function(err) {
                    if (err) {
                        node.error('Erreur DDATA [' + device.deviceId + '] : ' + err.message);
                        node.status({ fill: 'red', shape: 'dot', text: 'Erreur DDATA' });
                    } else {
                        node.status({ fill: 'green', shape: 'dot', text: 'DDATA [' + device.deviceId + '] envoyé' });
                        emitDebug('DDATA', device.deviceId, topic, data);
                    }
                });
            });
        };

        // ── États connexion ───────────────────────────────────────────────────

        node.onConnected = function() {
            node.status({ fill: 'green', shape: 'ring', text: 'Connecté' });
            if (node.birthOnDeploy) node.sendAllBirths();
        };

        node.onConnecting = function() {
            node.status({ fill: 'yellow', shape: 'ring', text: 'Connexion...' });
        };

        node.onDisconnected = function() {
            node.status({ fill: 'red', shape: 'ring', text: 'Déconnecté' });
        };

        node.onError = function(errMsg) {
            node.status({ fill: 'red', shape: 'dot', text: 'Erreur: ' + errMsg });
        };

        // ── Init ──────────────────────────────────────────────────────────────

        node.config.register(node);

        if (isTest) {
            node.status({ fill: 'blue', shape: 'ring', text: '🧪 Test — ' + node.devices.length + ' device(s)' });
            if (node.birthOnDeploy) node.sendAllBirths();
        } else if (node.config.client && node.config.client.connected) {
            node.onConnected();
        } else {
            node.status({ fill: 'yellow', shape: 'ring', text: 'Connexion...' });
        }

        // ── DBIRTH périodique ─────────────────────────────────────────────────

        const INTERVAL_MAP = {
            '1h':  3600000,
            '6h':  21600000,
            '12h': 43200000,
            '24h': 86400000,
            '48h': 172800000
        };

        if (node.birthPeriodic) {
            const ms = INTERVAL_MAP[node.birthInterval] || INTERVAL_MAP['24h'];
            node._birthTimer = setInterval(function() {
                node.log('DBIRTH périodique (' + node.birthInterval + ')');
                node.sendAllBirths();
            }, ms);
            node.log('DBIRTH périodique activé : toutes les ' + node.birthInterval);
        }

        // ── Entrée ────────────────────────────────────────────────────────────
        // msg.topic === 'birth' → DBIRTH pour tous les devices
        // sinon                 → DDATA routage automatique

        node.on('input', function(msg, send, done) {
            if (msg.topic === 'birth') {
                node.sendAllBirths();
            } else {
                node.sendDataAuto(msg);
            }
            done();
        });

        node.on('close', function(done) {
            if (node._birthTimer) {
                clearInterval(node._birthTimer);
                node._birthTimer = null;
            }
            node.config.deregister(node);
            done();
        });
    }

    RED.nodes.registerType('scorp-io-device', ScorpIoDeviceNode);

    // ── Endpoint HTTP admin — bouton DBIRTH depuis l'UI ───────────────────────
    // POST /scorp-io/dbirth/:nodeId

    RED.httpAdmin.post('/scorp-io/dbirth/:nodeId', function(req, res) {
        const node = RED.nodes.getNode(req.params.nodeId);
        if (!node) {
            return res.status(404).json({ error: 'Nœud introuvable : ' + req.params.nodeId });
        }
        if (typeof node.sendAllBirths !== 'function') {
            return res.status(400).json({ error: 'Ce nœud ne supporte pas sendAllBirths' });
        }
        try {
            node.sendAllBirths();
            res.json({ ok: true, devices: (node.devices || []).map(d => d.deviceId) });
        } catch(e) {
            res.status(500).json({ error: e.message });
        }
    });
};
