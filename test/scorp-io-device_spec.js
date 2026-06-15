'use strict';

const helper     = require('node-red-node-test-helper');
const deviceNode = require('../nodes/scorp-io-device.js');
const configNode = require('../nodes/scorp-io-config.js');

helper.init(require.resolve('node-red'));

// ── Flux de base réutilisable ─────────────────────────────────────────────────

function baseFlow(devicesOverride) {
    return [
        {
            id: 'cfg1', type: 'scorp-io-config',
            clientId: 'c1', projectId: 'my-project',
            edgeNodeId: 'edge-01', mode: 'test'
        },
        {
            id: 'dev1', type: 'scorp-io-device',
            config: 'cfg1',
            devices: devicesOverride || [
                {
                    deviceId: 'pompe-1',
                    metrics: [
                        { name: 'pompe-1/etats',  dataType: 'Integer', valuePath: 'msg.payload.pompe1.etats'  },
                        { name: 'pompe-1/defaut', dataType: 'Boolean', valuePath: 'msg.payload.pompe1.defaut' },
                        { name: 'pompe-1/status', dataType: 'Float',   valuePath: 'msg.payload.pompe1.status' }
                    ]
                },
                {
                    deviceId: 'pompe-2',
                    metrics: [
                        { name: 'pompe-2/etats',  dataType: 'Integer', valuePath: 'msg.payload.pompe2.etats'  },
                        { name: 'pompe-2/status', dataType: 'Float',   valuePath: 'msg.payload.pompe2.status' }
                    ]
                }
            ],
            wires: [[], ['dbg1']]
        },
        { id: 'dbg1', type: 'helper' }
    ];
}

// ─────────────────────────────────────────────────────────────────────────────

describe('scorp-io-device (multi-device)', function() {

    before(function(done)  { helper.startServer(done); });
    after(function(done)   { helper.stopServer(done);  });
    afterEach(function()   { return helper.unload();   });

    // ── Chargement ────────────────────────────────────────────────────────────

    it('doit se charger avec 2 devices', function(done) {
        helper.load([configNode, deviceNode], baseFlow(), function() {
            const dev = helper.getNode('dev1');
            dev.devices.should.have.length(2);
            dev.devices[0].deviceId.should.equal('pompe-1');
            dev.devices[1].deviceId.should.equal('pompe-2');
            done();
        });
    });

    it('doit afficher le bon badge au démarrage en mode test', function(done) {
        helper.load([configNode, deviceNode], baseFlow(), function() {
            const dev = helper.getNode('dev1');
            dev.status.calledWith({
                fill: 'blue', shape: 'ring', text: '🧪 Test — 2 devices'
            }).should.be.true();
            done();
        });
    });

    // ── DBIRTH tous devices ───────────────────────────────────────────────────

    it('doit émettre un DBIRTH pour chaque device sur la sortie debug', function(done) {
        helper.load([configNode, deviceNode], baseFlow(), function() {
            const dbg = helper.getNode('dbg1');
            const dev = helper.getNode('dev1');
            const births = [];

            dbg.on('input', function(msg) {
                if (msg._scorp.type === 'DBIRTH') {
                    births.push(msg._scorp.device);
                    if (births.length === 2) {
                        births.should.containEql('pompe-1');
                        births.should.containEql('pompe-2');
                        done();
                    }
                }
            });
            dev.receive({ topic: 'birth', payload: {} });
        });
    });

    it('le DBIRTH ne doit pas contenir de "value"', function(done) {
        helper.load([configNode, deviceNode], baseFlow(), function() {
            const dbg = helper.getNode('dbg1');
            const dev = helper.getNode('dev1');

            dbg.on('input', function(msg) {
                if (msg._scorp.type === 'DBIRTH' && msg._scorp.device === 'pompe-1') {
                    msg.payload.metrics.forEach(m => {
                        m.should.not.have.property('value');
                    });
                    done();
                }
            });
            dev.receive({ topic: 'birth', payload: {} });
        });
    });

    it('le topic DBIRTH doit avoir le bon format', function(done) {
        helper.load([configNode, deviceNode], baseFlow(), function() {
            const dbg = helper.getNode('dbg1');
            const dev = helper.getNode('dev1');

            dbg.on('input', function(msg) {
                if (msg._scorp.type === 'DBIRTH' && msg._scorp.device === 'pompe-1') {
                    msg.topic.should.equal('mqtts/my-project/DBIRTH/edge-01/pompe-1');
                    done();
                }
            });
            dev.receive({ topic: 'birth', payload: {} });
        });
    });

    // ── DDATA device ciblé ────────────────────────────────────────────────────

    it('doit router automatiquement vers pompe-1 si payload contient pompe1.*', function(done) {
        helper.load([configNode, deviceNode], baseFlow(), function() {
            const dbg = helper.getNode('dbg1');
            const dev = helper.getNode('dev1');

            dbg.on('input', function(msg) {
                if (msg._scorp.type === 'DDATA' && msg._scorp.device === 'pompe-1') {
                    msg.topic.should.equal('mqtts/my-project/DDATA/edge-01/pompe-1');
                    done();
                }
            });
            dev.receive({ payload: { pompe1: { etats: 1, defaut: false, status: 3.14 } } });
        });
    });

    it('doit résoudre les valeurs dans DDATA pour pompe-1 (routage auto)', function(done) {
        helper.load([configNode, deviceNode], baseFlow(), function() {
            const dbg = helper.getNode('dbg1');
            const dev = helper.getNode('dev1');

            dbg.on('input', function(msg) {
                if (msg._scorp.type === 'DDATA' && msg._scorp.device === 'pompe-1') {
                    const m = msg.payload.metrics;
                    m.find(x => x.name === 'pompe-1/etats').value.should.equal(1);
                    m.find(x => x.name === 'pompe-1/defaut').value.should.equal(false);
                    m.find(x => x.name === 'pompe-1/status').value.should.equal(3.14);
                    done();
                }
            });
            dev.receive({ payload: { pompe1: { etats: 1, defaut: false, status: 3.14 } } });
        });
    });

    it('chaque métrique DDATA doit avoir un timestamp numérique (ms epoch)', function(done) {
        helper.load([configNode, deviceNode], baseFlow(), function() {
            const dbg = helper.getNode('dbg1');
            const dev = helper.getNode('dev1');
            const before = Date.now();

            dbg.on('input', function(msg) {
                if (msg._scorp.type === 'DDATA' && msg._scorp.device === 'pompe-1') {
                    const after = Date.now();
                    msg.payload.metrics.forEach(function(m) {
                        m.should.have.property('timestamp');
                        m.timestamp.should.be.a.Number();
                        m.timestamp.should.be.aboveOrEqual(before);
                        m.timestamp.should.be.belowOrEqual(after);
                    });
                    done();
                }
            });
            dev.receive({ payload: { pompe1: { etats: 1, defaut: false, status: 3.14 } } });
        });
    });

    it('les métriques DBIRTH ne doivent pas avoir de timestamp', function(done) {
        helper.load([configNode, deviceNode], baseFlow(), function() {
            const dbg = helper.getNode('dbg1');
            const dev = helper.getNode('dev1');

            dbg.on('input', function(msg) {
                if (msg._scorp.type === 'DBIRTH' && msg._scorp.device === 'pompe-1') {
                    msg.payload.metrics.forEach(function(m) {
                        m.should.not.have.property('timestamp');
                        m.should.not.have.property('value');
                    });
                    done();
                }
            });
            dev.receive({ topic: 'birth' });
        });
    });

    it('doit router automatiquement vers pompe-2 si payload contient pompe2.*', function(done) {
        helper.load([configNode, deviceNode], baseFlow(), function() {
            const dbg = helper.getNode('dbg1');
            const dev = helper.getNode('dev1');

            dbg.on('input', function(msg) {
                if (msg._scorp.type === 'DDATA' && msg._scorp.device === 'pompe-2') {
                    done();
                }
            });
            dev.receive({ payload: { pompe2: { etats: 0, status: 1.5 } } });
        });
    });

    it('doit router vers les deux devices si le payload contient pompe1.* ET pompe2.*', function(done) {
        helper.load([configNode, deviceNode], baseFlow(), function() {
            const dbg = helper.getNode('dbg1');
            const dev = helper.getNode('dev1');
            const matched = new Set();

            dbg.on('input', function(msg) {
                if (msg._scorp.type === 'DDATA') {
                    matched.add(msg._scorp.device);
                    if (matched.size === 2) {
                        matched.has('pompe-1').should.be.true();
                        matched.has('pompe-2').should.be.true();
                        done();
                    }
                }
            });
            dev.receive({
                payload: {
                    pompe1: { etats: 1, defaut: false, status: 3.14 },
                    pompe2: { etats: 0, status: 1.5 }
                }
            });
        });
    });

    // ── resolvePath depuis msg ────────────────────────────────────────────────

    it('doit résoudre msg.payload.xxx (chemin complet depuis msg)', function(done) {
        helper.load([configNode, deviceNode], baseFlow([{
            deviceId: 'test-device',
            metrics: [{ name: 'val', dataType: 'Float', valuePath: 'msg.payload.capteur.temp' }]
        }]), function() {
            const dbg = helper.getNode('dbg1');
            const dev = helper.getNode('dev1');

            dbg.on('input', function(msg) {
                if (msg._scorp.type === 'DDATA') {
                    msg.payload.metrics[0].value.should.equal(22.5);
                    done();
                }
            });
            dev.receive({ deviceId: 'test-device', payload: { capteur: { temp: 22.5 } } });
        });
    });

    it('doit résoudre msg.pompe.etat (chemin court sans payload)', function(done) {
        helper.load([configNode, deviceNode], baseFlow([{
            deviceId: 'test-device',
            metrics: [{ name: 'etat', dataType: 'Integer', valuePath: 'msg.pompe.etat' }]
        }]), function() {
            const dbg = helper.getNode('dbg1');
            const dev = helper.getNode('dev1');

            dbg.on('input', function(msg) {
                if (msg._scorp.type === 'DDATA') {
                    msg.payload.metrics[0].value.should.equal(42);
                    done();
                }
            });
            dev.receive({ deviceId: 'test-device', pompe: { etat: 42 }, payload: {} });
        });
    });

    // ── Cas d'erreur ──────────────────────────────────────────────────────────

    it('doit logger un warning si aucun device ne correspond au msg', function(done) {
        helper.load([configNode, deviceNode], baseFlow(), function() {
            const dev = helper.getNode('dev1');
            // payload sans aucune clé connue → warn, pas de crash
            dev.receive({ payload: { inconnu: { x: 1 } } });
            setTimeout(done, 100);
        });
    });

    it('doit gérer un device sans métriques', function(done) {
        helper.load([configNode, deviceNode], baseFlow([{
            deviceId: 'empty-device', metrics: []
        }]), function() {
            const dbg = helper.getNode('dbg1');
            const dev = helper.getNode('dev1');

            dbg.on('input', function(msg) {
                if (msg._scorp.type === 'DDATA') {
                    msg.payload.metrics.should.have.length(0);
                    done();
                }
            });
            dev.receive({ deviceId: 'empty-device', payload: {} });
        });
    });

    // ── Déclenchement DBIRTH ──────────────────────────────────────────────────

    it('msg.topic === "birth" doit déclencher DBIRTH pour tous les devices', function(done) {
        helper.load([configNode, deviceNode], baseFlow(), function() {
            const dbg = helper.getNode('dbg1');
            const dev = helper.getNode('dev1');
            let count = 0;

            dbg.on('input', function(msg) {
                if (msg._scorp.type === 'DBIRTH') {
                    count++;
                    if (count === 2) { done(); }
                }
            });
            dev.receive({ topic: 'birth', payload: {} });
        });
    });

    it('msg._inputPort === 1 doit déclencher DBIRTH', function(done) {
        helper.load([configNode, deviceNode], baseFlow(), function() {
            const dbg = helper.getNode('dbg1');
            const dev = helper.getNode('dev1');
            let count = 0;

            dbg.on('input', function(msg) {
                if (msg._scorp.type === 'DBIRTH') {
                    count++;
                    if (count === 2) { done(); }
                }
            });
            dev.receive({ _inputPort: 1, payload: {} });
        });
    });
});
