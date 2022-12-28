import * as chai from 'chai';
import { default as sinon } from 'ts-sinon';
import * as sinonChai from 'sinon-chai';
import 'mocha';

import { CachingClientWrapper } from '../../src/client/caching-client-wrapper';

chai.use(sinonChai);

describe('CachingClientWrapper', () => {
  const expect = chai.expect;
  let cachingClientWrapperUnderTest: CachingClientWrapper;
  let clientWrapperStub: any;
  let redisClientStub: any;
  let idMap: any;

  beforeEach(() => {
    clientWrapperStub = {
      getDailyApiUsage: sinon.spy(),
      getWeeklyApiUsage: sinon.spy(),
      getActivitiesByLeadId: sinon.spy(),
      getActivityPagingToken: sinon.spy(),
      getActivityTypes: sinon.spy(),
      deleteCustomObjectById: sinon.spy(),
      findLeadByEmail: sinon.spy(),
      findLeadByField: sinon.spy(),
      deleteLeadById: sinon.spy(),
      describeLeadFields: sinon.spy(),
      addLeadToSmartCampaign: sinon.spy(),
      getCampaigns: sinon.spy(),
      createOrUpdateLead: sinon.spy(),
      getCustomObject: sinon.spy(),
      queryCustomObject: sinon.spy(),
      createOrUpdateCustomObject: sinon.spy(),
      mergeLeadsById: sinon.spy(),
    };

    redisClientStub = {
      get: sinon.spy(),
      setex: sinon.spy(),
      del: sinon.spy(),
    };

    idMap = {
      requestId: '1',
      scenarioId: '2',
      requestorId: '3',
    };
  });

  it('findLeadByEmail using original function', (done) => {
    const expectedEmail = 'test@example.com';
    cachingClientWrapperUnderTest = new CachingClientWrapper(clientWrapperStub, redisClientStub, idMap, null);
    cachingClientWrapperUnderTest.getAsync = sinon.stub().returns(false);
    cachingClientWrapperUnderTest.findLeadByEmail(expectedEmail);

    setTimeout(() => {
      expect(clientWrapperStub.findLeadByEmail).to.have.been.calledWith(expectedEmail);
      done();
    });
  });

  it('findLeadByEmail using cache', (done) => {
    const expectedEmail = 'test@example.com';
    cachingClientWrapperUnderTest = new CachingClientWrapper(clientWrapperStub, redisClientStub, idMap, null);
    cachingClientWrapperUnderTest.getAsync = sinon.stub();
    cachingClientWrapperUnderTest.getAsync.returns('"expectedCachedValue"');
    let actualCachedValue: string;
    (async () => {
      actualCachedValue = await cachingClientWrapperUnderTest.findLeadByEmail(expectedEmail);
    })();

    setTimeout(() => {
      expect(clientWrapperStub.findLeadByEmail).to.not.have.been.called;
      expect(actualCachedValue).to.equal('expectedCachedValue');
      done();
    });
  });

  it('findLeadByField using original function', (done) => {
    const expectedField = 'firstName';
    const expectedId = '123';
    cachingClientWrapperUnderTest = new CachingClientWrapper(clientWrapperStub, redisClientStub, idMap, null);
    cachingClientWrapperUnderTest.getAsync = sinon.stub().returns(false);
    cachingClientWrapperUnderTest.findLeadByField(expectedField, expectedId);

    setTimeout(() => {
      expect(clientWrapperStub.findLeadByField).to.have.been.calledWith(expectedField, expectedId);
      done();
    });
  });

  it('findLeadByField using cache', (done) => {
    const expectedField = 'firstName';
    const expectedId = '123';
    cachingClientWrapperUnderTest = new CachingClientWrapper(clientWrapperStub, redisClientStub, idMap, null);
    cachingClientWrapperUnderTest.getAsync = sinon.stub();
    cachingClientWrapperUnderTest.getAsync.returns('"expectedCachedValue"');
    let actualCachedValue: string;
    (async () => {
      actualCachedValue = await cachingClientWrapperUnderTest.findLeadByField(expectedField, expectedId);
    })();

    setTimeout(() => {
      expect(clientWrapperStub.findLeadByField).to.not.have.been.called;
      expect(actualCachedValue).to.equal('expectedCachedValue');
      done();
    });
  });

  it('createOrUpdateLead', (done) => {
    const expectedLead = { email: 'test@example.com' };
    cachingClientWrapperUnderTest = new CachingClientWrapper(clientWrapperStub, redisClientStub, idMap, null);
    cachingClientWrapperUnderTest.clearCache = sinon.spy();
    cachingClientWrapperUnderTest.createOrUpdateLead(expectedLead);

    setTimeout(() => {
      expect(clientWrapperStub.createOrUpdateLead).to.have.been.calledWith(expectedLead);
      expect(cachingClientWrapperUnderTest.clearCache).to.have.been.called;
      done();
    });
  });

  it('deleteLeadById', (done) => {
    const expectedId = 123;
    cachingClientWrapperUnderTest = new CachingClientWrapper(clientWrapperStub, redisClientStub, idMap, null);
    cachingClientWrapperUnderTest.clearCache = sinon.spy();
    cachingClientWrapperUnderTest.deleteLeadById(expectedId);

    setTimeout(() => {
      expect(cachingClientWrapperUnderTest.clearCache).to.have.been.called;
      expect(clientWrapperStub.deleteLeadById).to.have.been.calledWith(expectedId);
      done();
    });
  });

  it('describeLeadFields using original function', (done) => {
    const expectedEmail = 'test@example.com';
    cachingClientWrapperUnderTest = new CachingClientWrapper(clientWrapperStub, redisClientStub, idMap, null);
    cachingClientWrapperUnderTest.getAsync = sinon.stub().returns(false);
    cachingClientWrapperUnderTest.describeLeadFields(expectedEmail);

    setTimeout(() => {
      expect(clientWrapperStub.describeLeadFields).to.have.been.called;
      done();
    });
  });

  it('describeLeadFields using cache', (done) => {
    const expectedEmail = 'test@example.com';
    cachingClientWrapperUnderTest = new CachingClientWrapper(clientWrapperStub, redisClientStub, idMap, null);
    cachingClientWrapperUnderTest.getAsync = sinon.stub();
    cachingClientWrapperUnderTest.getAsync.returns('"expectedCachedValue"');
    let actualCachedValue: string;
    (async () => {
      actualCachedValue = await cachingClientWrapperUnderTest.describeLeadFields(expectedEmail);
    })();

    setTimeout(() => {
      expect(clientWrapperStub.describeLeadFields).to.not.have.been.called;
      expect(actualCachedValue).to.equal('expectedCachedValue');
      done();
    });
  });

  it('getCustomObject using original function', (done) => {
    const customObjectName = 'any';
    cachingClientWrapperUnderTest = new CachingClientWrapper(clientWrapperStub, redisClientStub, idMap, null);
    cachingClientWrapperUnderTest.getAsync = sinon.stub().returns(false);
    cachingClientWrapperUnderTest.getCustomObject(customObjectName);

    setTimeout(() => {
      expect(clientWrapperStub.getCustomObject).to.have.been.calledWith(customObjectName);
      done();
    });
  });

  it('getCustomObject using cache', (done) => {
    const customObjectName = 'any';
    cachingClientWrapperUnderTest = new CachingClientWrapper(clientWrapperStub, redisClientStub, idMap, null);
    cachingClientWrapperUnderTest.getAsync = sinon.stub();
    cachingClientWrapperUnderTest.getAsync.returns('"expectedCachedValue"');
    let actualCachedValue: string;
    (async () => {
      actualCachedValue = await cachingClientWrapperUnderTest.getCustomObject(customObjectName);
    })();

    setTimeout(() => {
      expect(clientWrapperStub.getCustomObject).to.not.have.been.called;
      expect(actualCachedValue).to.equal('expectedCachedValue');
      done();
    });
  });

  it('queryCustomObject using original function', (done) => {
    const customObjectName = 'any';
    const filterType = 'anyFilterType';
    const searchFields = [{ anySearchField: 'anySearchFieldValue' }];
    const requestFields = ['anyField'];
    cachingClientWrapperUnderTest = new CachingClientWrapper(clientWrapperStub, redisClientStub, idMap, null);
    cachingClientWrapperUnderTest.getAsync = sinon.stub().returns(false);
    cachingClientWrapperUnderTest.queryCustomObject(customObjectName, filterType, searchFields, requestFields);

    setTimeout(() => {
      expect(clientWrapperStub.queryCustomObject).to.have.been.calledWith(customObjectName, filterType, searchFields, requestFields);
      done();
    });
  });

  it('queryCustomObject using cache', (done) => {
    const customObjectName = 'any';
    const filterType = 'anyFilterType';
    const searchFields = [{ anySearchField: 'anySearchFieldValue' }];
    const requestFields = ['anyField'];
    cachingClientWrapperUnderTest = new CachingClientWrapper(clientWrapperStub, redisClientStub, idMap, null);
    cachingClientWrapperUnderTest.getAsync = sinon.stub();
    cachingClientWrapperUnderTest.getAsync.returns('"expectedCachedValue"');
    let actualCachedValue: string;
    (async () => {
      actualCachedValue = await cachingClientWrapperUnderTest.queryCustomObject(customObjectName, filterType, searchFields, requestFields);
    })();

    setTimeout(() => {
      expect(clientWrapperStub.queryCustomObject).to.not.have.been.called;
      expect(actualCachedValue).to.equal('expectedCachedValue');
      done();
    });
  });

  it('createOrUpdateCustomObject', (done) => {
    const customObjectName = 'any';
    const customObject = { anyField: 'anyValue' };
    cachingClientWrapperUnderTest = new CachingClientWrapper(clientWrapperStub, redisClientStub, idMap, null);
    cachingClientWrapperUnderTest.clearCache = sinon.spy();
    cachingClientWrapperUnderTest.createOrUpdateCustomObject(customObjectName, customObject);

    setTimeout(() => {
      expect(clientWrapperStub.createOrUpdateCustomObject).to.have.been.calledWith(customObjectName, customObject);
      expect(cachingClientWrapperUnderTest.clearCache).to.have.been.called;
      done();
    });
  });

  it('deleteCustomObjectById', (done) => {
    const customObjectName = 'any';
    const customObjectGUID = 'anyGUID';
    cachingClientWrapperUnderTest = new CachingClientWrapper(clientWrapperStub, redisClientStub, idMap, null);
    cachingClientWrapperUnderTest.clearCache = sinon.spy();
    cachingClientWrapperUnderTest.deleteCustomObjectById(customObjectName, customObjectGUID);

    setTimeout(() => {
      expect(cachingClientWrapperUnderTest.clearCache).to.have.been.called;
      expect(clientWrapperStub.deleteCustomObjectById).to.have.been.calledWith(customObjectName, customObjectGUID);
      done();
    });
  });

  it('getCampaigns using original function', (done) => {
    cachingClientWrapperUnderTest = new CachingClientWrapper(clientWrapperStub, redisClientStub, idMap, null);
    cachingClientWrapperUnderTest.getAsync = sinon.stub().returns(false);
    cachingClientWrapperUnderTest.getCampaigns();

    setTimeout(() => {
      expect(clientWrapperStub.getCampaigns).to.have.been.called;
      done();
    });
  });

  it('getCampaigns using cache', (done) => {
    cachingClientWrapperUnderTest = new CachingClientWrapper(clientWrapperStub, redisClientStub, idMap, null);
    cachingClientWrapperUnderTest.getAsync = sinon.stub().returns('"expectedCachedValue"');
    let actualCachedValue: string;
    (async () => {
      actualCachedValue = await cachingClientWrapperUnderTest.getCampaigns();
    })();

    setTimeout(() => {
      expect(clientWrapperStub.getCampaigns).to.not.have.been.called;
      expect(actualCachedValue).to.equal('expectedCachedValue');
      done();
    });
  });

  it('addLeadToSmartCampaign', (done) => {
    const campaignIdInput = 'someId';
    const leadInput = { name: 'someLead' };
    cachingClientWrapperUnderTest = new CachingClientWrapper(clientWrapperStub, redisClientStub, idMap, null);
    cachingClientWrapperUnderTest.clearCache = sinon.spy();
    cachingClientWrapperUnderTest.addLeadToSmartCampaign(campaignIdInput, leadInput);

    setTimeout(() => {
      expect(cachingClientWrapperUnderTest.clearCache).to.have.been.called;
      expect(clientWrapperStub.addLeadToSmartCampaign).to.have.been.calledWith(campaignIdInput, leadInput);
      done();
    });
  });

  it('getActivityTypes using original function', (done) => {
    cachingClientWrapperUnderTest = new CachingClientWrapper(clientWrapperStub, redisClientStub, idMap, null);
    cachingClientWrapperUnderTest.getActivityTypes();

    expect(clientWrapperStub.getActivityTypes).to.have.been.called;
    done();
  });

  it('getActivityPagingToken using original function', (done) => {
    const sinceDate = 'anyDate';
    cachingClientWrapperUnderTest = new CachingClientWrapper(clientWrapperStub, redisClientStub, idMap, null);
    cachingClientWrapperUnderTest.getActivityPagingToken(sinceDate);

    expect(clientWrapperStub.getActivityPagingToken).to.have.been.calledWith(sinceDate);
    done();
  });

  it('getActivitiesByLeadId using original function', (done) => {
    const nextPageToken = 'anyToken';
    const leadId = 'anyId';
    const activityId = 'anyActivityId';
    cachingClientWrapperUnderTest = new CachingClientWrapper(clientWrapperStub, redisClientStub, idMap, null);
    cachingClientWrapperUnderTest.getActivitiesByLeadId(nextPageToken, leadId, activityId);

    expect(clientWrapperStub.getActivitiesByLeadId).to.have.been.calledWith(nextPageToken, leadId, activityId);
    done();
  });

  it('getDailyApiUsage using original function', (done) => {
    cachingClientWrapperUnderTest = new CachingClientWrapper(clientWrapperStub, redisClientStub, idMap, null);
    cachingClientWrapperUnderTest.getDailyApiUsage();

    expect(clientWrapperStub.getDailyApiUsage).to.have.been.called;
    done();
  });

  it('getWeeklyApiUsage using original function', (done) => {
    cachingClientWrapperUnderTest = new CachingClientWrapper(clientWrapperStub, redisClientStub, idMap, null);
    cachingClientWrapperUnderTest.getWeeklyApiUsage();

    expect(clientWrapperStub.getWeeklyApiUsage).to.have.been.called;
    done();
  });

  it('mergeLeadsById using original function', (done) => {
    const winningId = '1';
    const losingIds = ['2'];
    cachingClientWrapperUnderTest = new CachingClientWrapper(clientWrapperStub, redisClientStub, idMap, null);
    cachingClientWrapperUnderTest.clearCache = sinon.spy();
    cachingClientWrapperUnderTest.mergeLeadsById(winningId, losingIds);

    setTimeout(() => {
      expect(cachingClientWrapperUnderTest.clearCache).to.have.been.called;
      expect(clientWrapperStub.mergeLeadsById).to.have.been.calledWith(winningId, losingIds);
      done();
    });
  });

  it('getCache', (done) => {
    redisClientStub.get = sinon.stub().yields();
    cachingClientWrapperUnderTest = new CachingClientWrapper(clientWrapperStub, redisClientStub, idMap, null);
    cachingClientWrapperUnderTest.getCache('expectedKey');

    setTimeout(() => {
      expect(redisClientStub.get).to.have.been.calledWith('expectedKey');
      done();
    });
  });

  it('setCache', (done) => {
    redisClientStub.setex = sinon.stub().yields(); 
    cachingClientWrapperUnderTest = new CachingClientWrapper(clientWrapperStub, redisClientStub, idMap, null);
    cachingClientWrapperUnderTest.getCache = sinon.stub().returns(null);
    cachingClientWrapperUnderTest.cachePrefix = 'testPrefix';
    cachingClientWrapperUnderTest.setCache('expectedKey', 'expectedValue');

    setTimeout(() => {
      expect(redisClientStub.setex).to.have.been.calledWith('expectedKey', 55, '"expectedValue"');
      expect(redisClientStub.setex).to.have.been.calledWith('cachekeys|testPrefix', 55, '["expectedKey"]');
      done();
    });
  });

  it('clearCache', (done) => {
    redisClientStub.del = sinon.stub().yields();
    cachingClientWrapperUnderTest = new CachingClientWrapper(clientWrapperStub, redisClientStub, idMap, null);
    cachingClientWrapperUnderTest.cachePrefix = 'testPrefix';
    cachingClientWrapperUnderTest.getCache = sinon.stub().returns(['testKey1', 'testKey2'])
    cachingClientWrapperUnderTest.clearCache();

    setTimeout(() => {
      expect(redisClientStub.del).to.have.been.calledWith('testKey1');
      expect(redisClientStub.del).to.have.been.calledWith('testKey2');
      expect(redisClientStub.setex).to.have.been.calledWith('cachekeys|testPrefix');
      done();
    });
  });

});
