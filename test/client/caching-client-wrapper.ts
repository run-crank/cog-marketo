import * as chai from 'chai';
import { default as sinon } from 'ts-sinon';
import * as sinonChai from 'sinon-chai';
import 'mocha';

import { CachingClientWrapper } from '../../src/client/caching-client-wrapper';
import { ClientWrapper } from '../../src/client/client-wrapper';
import { Metadata } from 'grpc';

chai.use(sinonChai);

describe('CachingClientWrapper', () => {
  const expect = chai.expect;
  let marketoClientStub: any;
  let marketoConstructorStub: any;
  let metadata: Metadata;
  let cachingClientWrapperUnderTest: CachingClientWrapper;
  let clientWrapperInstance: ClientWrapper;
  let clientWrapperStub: any;
  let redisClient: any;
  let redisClientStub: any;
  let idMap: any;

  beforeEach(() => {
    clientWrapperStub = {
      getDailyApiUsage: sinon.spy(),
      getWeeklyApiUsage: sinon.spy(),
      getActivities: sinon.spy(),
      getActivityPagingToken: sinon.spy(),
      getActivityTypes: sinon.spy(),
      deleteCustomObjectById: sinon.spy(),
      findLeadByEmail: sinon.spy(), 
      findLeadByField: sinon.spy(),
      deleteLeadById: sinon.spy()
    };
    
    redisClientStub = {
      get: sinon.stub(),
      setex: sinon.spy(),
      del: sinon.spy(),
    };

    marketoClientStub = {
      lead: {
        find: sinon.spy(),
        createOrUpdate: sinon.spy(),
        describe: sinon.spy(),
        partitions: sinon.spy(),
      },
      activities: {
        getActivityTypes: sinon.spy(),
      },
      _connection: {
        postJson: sinon.spy(),
        get: sinon.spy(),
      },
    };
    marketoConstructorStub = sinon.stub();
    marketoConstructorStub.returns(marketoClientStub);
    marketoClientStub.campaign = sinon.stub();
    marketoClientStub.campaign.getCampaigns = sinon.stub();
    marketoClientStub.campaign.request = sinon.stub();
    marketoClientStub.lead.describe = sinon.stub();
    marketoClientStub.lead.describe.returns(Promise.resolve({
      result: [{
        rest: {
          name: 'email',
        },
      }],
    }));
    marketoClientStub.lead.partitions = sinon.stub();
    marketoClientStub.lead.partitions.resolves({ result: [
      { id: 1, name: 'Default' },
    ]});

    idMap = {
      requestId: '1',
      scenarioId: '2',
      requestorId: '3',
    };
  });

  //test to check that the cachingClientWrapper is linked to the real clientWrapper
  // it('validates connection to ClientWrapper', (done) => {
  //   const clientWrapperExpectedArgs = {
  //     endpoint: 'https://abc-123-xyz.mktorest.example/rest',
  //     identity: 'https://abc-123-xyz.mktorest.example/identity',
  //     clientId: 'a-client-id',
  //     clientSecret: 'a-client-secret',
  //   };
  //   metadata = new Metadata();
  //   metadata.add('endpoint', clientWrapperExpectedArgs.endpoint.replace('/rest', ''));
  //   metadata.add('clientId', clientWrapperExpectedArgs.clientId);
  //   metadata.add('clientSecret', clientWrapperExpectedArgs.clientSecret);
    
  //   clientWrapperInstance = new ClientWrapper(metadata, marketoConstructorStub);
    
  //   const cachingClientWrapperExpectedArgs = {
  //     clientWrapperInstance: ,
  //     redisClient: ,
  //     idMap:
  //   }

  //   cachingClientWrapperUnderTest = new CachingClientWrapper(clientWrapperInstance, redisClient, idMap) //define later
  //   expect(cachingClientWrapperUnderTest).to.have.been.called.with()
  //   done()
  // })


  //make a test that checks the connection to the original clientWrapper
  //make a test for each of the non-cached functions that ensures it references the original function
  //make a test for each of the cached get functions that ensures it can both reference the original function, and the cache
  //make a test for each of the cached create/update/delete functions that ensures it can both reference the original function, and delete the cache


  // it('createOrUpdateLead', (done) => {
  //   const expectedLead = { email: 'test@example.com' };
  //   clientWrapperUnderTest = new ClientWrapper(metadata, marketoConstructorStub);
  //   clientWrapperUnderTest.createOrUpdateLead(expectedLead);

  //   setTimeout(() => {
  //     expect(marketoClientStub.lead.createOrUpdate).to.have.been.calledWith(
  //       [expectedLead],
  //       { lookupField: 'email', partitionName: 'Default'},
  //     );
  //     done();
  //   });
  // });

  it('findLeadByEmail using original function', (done) => {
    const expectedEmail = 'test@example.com';
    cachingClientWrapperUnderTest = new CachingClientWrapper(clientWrapperStub, redisClientStub, idMap);
    cachingClientWrapperUnderTest.getAsync = sinon.stub().returns(false);
    cachingClientWrapperUnderTest.findLeadByEmail(expectedEmail);

    setTimeout(() => {
      expect(clientWrapperStub.findLeadByEmail).to.have.been.calledWith(expectedEmail);
      done();
    });
  });

  it('findLeadByEmail using cache', (done) => {
    const expectedEmail = 'test@example.com';
    cachingClientWrapperUnderTest = new CachingClientWrapper(clientWrapperStub, redisClientStub, idMap);
    cachingClientWrapperUnderTest.getAsync = sinon.stub();
    cachingClientWrapperUnderTest.getAsync.returns('"expectedCachedValue"');
    let actualCachedValue: string;
    (async () => {
      actualCachedValue = await cachingClientWrapperUnderTest.findLeadByEmail(expectedEmail);
    })()
    
    setTimeout(() => {
      expect(clientWrapperStub.findLeadByEmail).to.not.have.been.called;
      expect(actualCachedValue).to.equal('expectedCachedValue');
      done();
    });
  });

  it('findLeadByField using original function', (done) => {
    const expectedField = 'firstName';
    const expectedId = '123';
    cachingClientWrapperUnderTest = new CachingClientWrapper(clientWrapperStub, redisClientStub, idMap);
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
    cachingClientWrapperUnderTest = new CachingClientWrapper(clientWrapperStub, redisClientStub, idMap);
    cachingClientWrapperUnderTest.getAsync = sinon.stub();
    cachingClientWrapperUnderTest.getAsync.returns('"expectedCachedValue"');
    let actualCachedValue: string;
    (async () => {
      actualCachedValue = await cachingClientWrapperUnderTest.findLeadByField(expectedField, expectedId);
    })()
    
    setTimeout(() => {
      expect(clientWrapperStub.findLeadByField).to.not.have.been.called;
      expect(actualCachedValue).to.equal('expectedCachedValue');
      done();
    });
  });

  it('deleteLeadById', (done) => {
    const expectedId = 123;
    cachingClientWrapperUnderTest = new CachingClientWrapper(clientWrapperStub, redisClientStub, idMap);
    cachingClientWrapperUnderTest.deleteDescriptionCache = sinon.spy();
    cachingClientWrapperUnderTest.deleteLeadCache = sinon.spy();
    cachingClientWrapperUnderTest.deleteLeadById(expectedId);

    setTimeout(() => {
      expect(cachingClientWrapperUnderTest.deleteDescriptionCache).to.have.been.called;
      expect(cachingClientWrapperUnderTest.deleteLeadCache).to.have.been.called;
      expect(clientWrapperStub.deleteLeadById).to.have.been.calledWith(expectedId);
      done();
    });
  });

  // it('describeLeadFields', () => {
  //   clientWrapperUnderTest = new ClientWrapper(metadata, marketoConstructorStub);
  //   clientWrapperUnderTest.describeLeadFields();

  //   expect(marketoClientStub.lead.describe).to.have.been.calledWith();
  // });

  // it('addLeadToSmartCampaign', () => {
  //   const campaignIdInput = 'someId';
  //   const leadInput = { name: 'someLead' };
  //   clientWrapperUnderTest = new ClientWrapper(metadata, marketoConstructorStub);
  //   clientWrapperUnderTest.addLeadToSmartCampaign(campaignIdInput, leadInput);

  //   expect(marketoClientStub.campaign.request).to.have.been.calledWith(campaignIdInput, [leadInput]);
  // });

  // // it('getCampaigns', () => {
  // //   clientWrapperUnderTest = new ClientWrapper(metadata, marketoConstructorStub);
  // //   clientWrapperUnderTest.getCampaigns();

  // //   expect(marketoClientStub.campaign.getCampaigns).to.have.been.calledWith();
  // // });

  // it('createOrUpdateCustomObject', () => {
  //   const customObjectName = 'any';
  //   const customObject = { anyField: 'anyValue'};
  //   clientWrapperUnderTest = new ClientWrapper(metadata, marketoConstructorStub);
  //   clientWrapperUnderTest.createOrUpdateCustomObject(customObjectName, customObject);

  //   expect(marketoClientStub._connection.postJson).to.have.been.calledWith(
  //     `/v1/customobjects/${customObjectName}.json`,
  //     {
  //       action: 'createOrUpdate',
  //       dedupeBy: 'dedupeFields',
  //       input: [customObject],
  //     },
  //     {
  //       query: {
  //         _method: 'POST',
  //       },
  //     },
  //   );
  // });

  // it('getCustomObject', () => {
  //   const customObjectName = 'any';
  //   const customObject = { anyField: 'anyValue' };
  //   clientWrapperUnderTest = new ClientWrapper(metadata, marketoConstructorStub);
  //   clientWrapperUnderTest.getCustomObject(customObjectName);

  //   expect(marketoClientStub._connection.get).to.have.been.calledWith(
  //     `/v1/customobjects/${customObjectName}/describe.json`,
  //     { query: { _method: 'GET' } },
  //   );
  // });

  // it('queryCustomObject(mutiple searchFields)', async () => {
  //   const customObjectName = 'any';
  //   const filterType = 'anyFilterType';
  //   const searchFields = [{ anySearchField: 'anySearchFieldValue' }];
  //   const requestFields = ['anyField'];
  //   clientWrapperUnderTest = new ClientWrapper(metadata, marketoConstructorStub);
  //   clientWrapperUnderTest.customObjectDescriptions = {
  //     [customObjectName]: {result: [{fields: requestFields.map(f => {return {name: f}})}]},
  //   },
  //   await clientWrapperUnderTest.queryCustomObject(customObjectName, filterType, searchFields);

  //   expect(marketoClientStub._connection.postJson).to.have.been.calledWith(
  //     `/v1/customobjects/${customObjectName}.json`,
  //     {
  //       filterType: `${filterType}`,
  //       fields: requestFields,
  //       input: searchFields,
  //     },
  //     {
  //       query: {
  //         _method: 'GET' ,
  //       },
  //     },
  //   );
  // });

  // it('queryCustomObject(single searchFields)', async () => {
  //   const customObjectName = 'any';
  //   const filterType = 'anyFilterType';
  //   const searchFields = ['anySearchFieldValue'];
  //   const requestFields = ['anyField'];
  //   clientWrapperUnderTest = new ClientWrapper(metadata, marketoConstructorStub);
  //   clientWrapperUnderTest.customObjectDescriptions = {
  //     [customObjectName]: {result: [{fields: requestFields.map(f => {return {name: f}})}]},
  //   },
  //   await clientWrapperUnderTest.queryCustomObject(customObjectName, filterType, searchFields);

  //   expect(marketoClientStub._connection.get).to.have.been.calledWith(
  //     `/v1/customobjects/${customObjectName}.json?filterType=${filterType}&filterValues=${searchFields.join(',')}&fields=${requestFields.join(',')}`,
  //   );
  // });

  // it('deleteCustomObjectById', () => {
  //   const customObjectName = 'any';
  //   const customObjectGUID = 'anyGUID';
  //   clientWrapperUnderTest = new ClientWrapper(metadata, marketoConstructorStub);
  //   clientWrapperUnderTest.deleteCustomObjectById(customObjectName, customObjectGUID);

  //   expect(marketoClientStub._connection.postJson).to.have.been.calledWith(
  //     `/v1/customobjects/${customObjectName}/delete.json`,
  //     {
  //       deleteBy: 'idField',
  //       input: [{
  //         marketoGUID: customObjectGUID,
  //       }],
  //     },
  //   );
  // });

  it('getActivityTypes', (done) => {
    cachingClientWrapperUnderTest = new CachingClientWrapper(clientWrapperStub, redisClientStub, idMap);
    cachingClientWrapperUnderTest.getActivityTypes();

    expect(clientWrapperStub.getActivityTypes).to.have.been.called;
    done()
  });

  it('getActivityPagingToken', (done) => {
    const sinceDate = 'anyDate';
    cachingClientWrapperUnderTest = new CachingClientWrapper(clientWrapperStub, redisClientStub, idMap);
    cachingClientWrapperUnderTest.getActivityPagingToken(sinceDate);

    expect(clientWrapperStub.getActivityPagingToken).to.have.been.calledWith(sinceDate);
    done()
  });

  it('getActivities', (done) => {
    const nextPageToken = 'anyToken';
    const leadId = 'anyId';
    const activityId = 'anyActivityId';
    cachingClientWrapperUnderTest = new CachingClientWrapper(clientWrapperStub, redisClientStub, idMap);
    cachingClientWrapperUnderTest.getActivities(nextPageToken, leadId, activityId);

    expect(clientWrapperStub.getActivities).to.have.been.calledWith(nextPageToken, leadId, activityId);
    done()
  });

  it('getDailyApiUsage', (done) => {
    cachingClientWrapperUnderTest = new CachingClientWrapper(clientWrapperStub, redisClientStub, idMap);
    cachingClientWrapperUnderTest.getDailyApiUsage();

    expect(clientWrapperStub.getDailyApiUsage).to.have.been.called;
    done()
  });

  it('getWeeklyApiUsage', (done) => {
    cachingClientWrapperUnderTest = new CachingClientWrapper(clientWrapperStub, redisClientStub, idMap);
    cachingClientWrapperUnderTest.getWeeklyApiUsage();

    expect(clientWrapperStub.getWeeklyApiUsage).to.have.been.called;
    done()
  });
});
