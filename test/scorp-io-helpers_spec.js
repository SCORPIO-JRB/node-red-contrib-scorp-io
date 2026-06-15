'use strict';
require('should');

// ── resolvePath standalone (depuis msg) ───────────────────────────────────────
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

function buildTopic(projectId, edgeNodeId, deviceId, msgType) {
    return ['mqtts', projectId, msgType, edgeNodeId, deviceId].join('/');
}

// ─────────────────────────────────────────────────────────────────────────────

describe('helpers — resolvePath (depuis msg)', function() {

    // Chemins complets depuis msg
    it('résout msg.payload.a',            () => resolvePath({ payload: { a: 1 } }, 'msg.payload.a').should.equal(1));
    it('résout msg.payload.a.b',          () => resolvePath({ payload: { a: { b: 2 } } }, 'msg.payload.a.b').should.equal(2));
    it('résout msg.pompe.etat',           () => resolvePath({ pompe: { etat: 42 } }, 'msg.pompe.etat').should.equal(42));
    it('résout msg.topic',                () => resolvePath({ topic: 'test' }, 'msg.topic').should.equal('test'));
    it('résout msg.payload direct',       () => resolvePath({ payload: 99 }, 'msg.payload').should.equal(99));

    // Fallback sans préfixe msg.
    it('fallback sur payload si pas msg.', () => resolvePath({ payload: { x: 5 } }, 'x').should.equal(5));

    // Cas limites
    it('retourne undefined si chemin vide',     () => (resolvePath({ payload: {} }, '') === undefined).should.be.true());
    it('retourne undefined si rawPath null',     () => (resolvePath({ payload: {} }, null) === undefined).should.be.true());
    it('retourne undefined si msg null',         () => (resolvePath(null, 'msg.payload.x') === undefined).should.be.true());
    it('retourne undefined si clé inexistante',  () => (resolvePath({ payload: {} }, 'msg.payload.x') === undefined).should.be.true());
    it('retourne undefined si chemin partiel',   () => (resolvePath({ payload: { a: 1 } }, 'msg.payload.a.b') === undefined).should.be.true());

    // Valeurs falsy
    it('résout false correctement',  () => resolvePath({ payload: { flag: false } }, 'msg.payload.flag').should.equal(false));
    it('résout 0 correctement',      () => resolvePath({ payload: { val: 0 } }, 'msg.payload.val').should.equal(0));
    it('résout null correctement',   () => (resolvePath({ payload: { val: null } }, 'msg.payload.val') === null).should.be.true());
    it('résout un float',            () => resolvePath({ payload: { temp: 22.5 } }, 'msg.payload.temp').should.equal(22.5));

    // Chemin profond
    it('résout un chemin à 4 niveaux', () =>
        resolvePath({ payload: { a: { b: { c: { d: 99 } } } } }, 'msg.payload.a.b.c.d').should.equal(99));

    // Ne plante pas
    it('ne plante pas sur msg vide {}',  () => (resolvePath({}, 'msg.payload.x') === undefined).should.be.true());
    it('ne plante pas sur payload null', () => (resolvePath({ payload: null }, 'msg.payload.x') === undefined).should.be.true());
});

describe('helpers — buildTopic', function() {

    it('format DBIRTH correct', () =>
        buildTopic('proj', 'edge', 'device', 'DBIRTH').should.equal('mqtts/proj/DBIRTH/edge/device'));

    it('format DDATA correct', () =>
        buildTopic('proj', 'edge', 'device', 'DDATA').should.equal('mqtts/proj/DDATA/edge/device'));

    it('premier segment = "mqtts"', () =>
        buildTopic('p', 'e', 'd', 'DBIRTH').split('/')[0].should.equal('mqtts'));

    it('5 segments au total', () =>
        buildTopic('p', 'e', 'd', 'DDATA').split('/').should.have.length(5));

    it('ordre mqtts/PROJECT/TYPE/EDGE/DEVICE', function() {
        const p = buildTopic('my-project', 'edge-01', 'pompe-1', 'DDATA').split('/');
        p[0].should.equal('mqtts');
        p[1].should.equal('my-project');
        p[2].should.equal('DDATA');
        p[3].should.equal('edge-01');
        p[4].should.equal('pompe-1');
    });

    it('accepte des IDs avec tirets', () =>
        buildTopic('mon-projet', 'edge-node-01', 'pompe-1', 'DBIRTH')
            .should.equal('mqtts/mon-projet/DBIRTH/edge-node-01/pompe-1'));
});
