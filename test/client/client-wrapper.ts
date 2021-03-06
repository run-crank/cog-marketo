import * as chai from 'chai';
import { default as sinon } from 'ts-sinon';
import * as sinonChai from 'sinon-chai';
import 'mocha';

import { ClientWrapper } from '../../src/client/client-wrapper';
import { Metadata } from 'grpc';

chai.use(sinonChai);

describe('ClientWrapper', () => {
  const expect = chai.expect;
  let marketoClientStub: any;
  let marketoConstructorStub: any;
  let metadata: Metadata;
  let clientWrapperUnderTest: ClientWrapper;

  beforeEach(() => {
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
  });

  it('authentication', () => {
    // Construct grpc metadata and assert the client was authenticated.
    const expectedCallArgs = {
      endpoint: 'https://abc-123-xyz.mktorest.example/rest',
      identity: 'https://abc-123-xyz.mktorest.example/identity',
      clientId: 'a-client-id',
      clientSecret: 'a-client-secret',
    };
    metadata = new Metadata();
    metadata.add('endpoint', expectedCallArgs.endpoint.replace('/rest', ''));
    metadata.add('clientId', expectedCallArgs.clientId);
    metadata.add('clientSecret', expectedCallArgs.clientSecret);

    // Assert that the underlying API client was authenticated correctly.
    clientWrapperUnderTest = new ClientWrapper(metadata, marketoConstructorStub);
    expect(marketoConstructorStub).to.have.been.calledWith(expectedCallArgs);
  });

  it('authentication::partner', () => {
    // Construct grpc metadata and assert the client was authenticated.
    const expectedCallArgs = {
      endpoint: 'https://abc-123-xyz.mktorest.example/rest',
      identity: 'https://abc-123-xyz.mktorest.example/identity',
      clientId: 'a-client-id',
      clientSecret: 'a-client-secret',
      partnerId: 'some-partner-id',
    };
    metadata = new Metadata();
    metadata.add('endpoint', expectedCallArgs.endpoint.replace('/rest', ''));
    metadata.add('clientId', expectedCallArgs.clientId);
    metadata.add('clientSecret', expectedCallArgs.clientSecret);
    metadata.add('partnerId', expectedCallArgs.partnerId);

    // Assert that the underlying API client was authenticated correctly.
    clientWrapperUnderTest = new ClientWrapper(metadata, marketoConstructorStub);
    expect(marketoConstructorStub).to.have.been.calledWith(expectedCallArgs);
  });

  it('createOrUpdateLead', (done) => {
    const expectedLead = { email: 'test@example.com' };
    clientWrapperUnderTest = new ClientWrapper(metadata, marketoConstructorStub);
    clientWrapperUnderTest.createOrUpdateLead(expectedLead);

    setTimeout(() => {
      expect(marketoClientStub.lead.createOrUpdate).to.have.been.calledWith(
        [expectedLead],
        { lookupField: 'email', partitionName: 'Default'},
      );
      done();
    });
  });

  it('findLeadByEmail (no options)', (done) => {
    const expectedEmail = 'test@example.com';
    clientWrapperUnderTest = new ClientWrapper(metadata, marketoConstructorStub);
    clientWrapperUnderTest.findLeadByEmail(expectedEmail);

    setTimeout(() => {
      expect(marketoClientStub.lead.find).to.have.been.calledWith(
        'email',
        [expectedEmail],
        { fields: ['email'] },
      );
      done();
    });
  });

  it('findLeadByEmail (with options)', (done) => {
    const expectedEmail = 'test@example.com';
    clientWrapperUnderTest = new ClientWrapper(metadata, marketoConstructorStub);
    clientWrapperUnderTest.findLeadByEmail(expectedEmail);

    setTimeout(() => {
      expect(marketoClientStub.lead.find).to.have.been.calledWith(
        'email',
        [expectedEmail],
        { fields: ['email'] },
      );

      done();
    });
  });

  it('findLeadByEmail (with partition id)', (done) => {
    const expectedEmail = 'test-in-partition-2@example.com';
    const expectedPartition = 1;

    marketoClientStub.lead.find = sinon.stub();
    marketoClientStub.lead.find.returns(Promise.resolve({
      result: [{
        email: `not-${expectedEmail}`,
        leadPartitionId: expectedPartition * 2,
      }, {
        email: expectedEmail,
        leadPartitionId: expectedPartition,
      }],
    }));

    clientWrapperUnderTest = new ClientWrapper(metadata, marketoConstructorStub);
    clientWrapperUnderTest.findLeadByEmail(expectedEmail, null, expectedPartition).then((res) => {
      try {
        expect(res.result[0].email).to.equal(expectedEmail);
      } catch (e) {
        return done(e);
      }
      done();
    });
  });

  it('deleteLeadById', () => {
    const expectedId = 123;
    clientWrapperUnderTest = new ClientWrapper(metadata, marketoConstructorStub);
    clientWrapperUnderTest.deleteLeadById(expectedId);

    expect(marketoClientStub._connection.postJson).to.have.been.calledWith(
      '/v1/leads.json',
      { input: [ { id: expectedId } ] },
      { query: { _method: 'DELETE' } }
    );
  });

  it('describeLeadFields', () => {
    clientWrapperUnderTest = new ClientWrapper(metadata, marketoConstructorStub);
    clientWrapperUnderTest.describeLeadFields();

    expect(marketoClientStub.lead.describe).to.have.been.calledWith();
  });

  it('addLeadToSmartCampaign', () => {
    const campaignIdInput = 'someId';
    const leadInput = { name: 'someLead' };
    clientWrapperUnderTest = new ClientWrapper(metadata, marketoConstructorStub);
    clientWrapperUnderTest.addLeadToSmartCampaign(campaignIdInput, leadInput);

    expect(marketoClientStub.campaign.request).to.have.been.calledWith(campaignIdInput, [leadInput]);
  });

  // it('getCampaigns', () => {
  //   clientWrapperUnderTest = new ClientWrapper(metadata, marketoConstructorStub);
  //   clientWrapperUnderTest.getCampaigns();

  //   expect(marketoClientStub.campaign.getCampaigns).to.have.been.calledWith();
  // });

  it('createOrUpdateCustomObject', () => {
    const customObjectName = 'any';
    const customObject = { anyField: 'anyValue'};
    clientWrapperUnderTest = new ClientWrapper(metadata, marketoConstructorStub);
    clientWrapperUnderTest.createOrUpdateCustomObject(customObjectName, customObject);

    expect(marketoClientStub._connection.postJson).to.have.been.calledWith(
      `/v1/customobjects/${customObjectName}.json`,
      {
        action: 'createOrUpdate',
        dedupeBy: 'dedupeFields',
        input: [customObject],
      },
      {
        query: {
          _method: 'POST',
        },
      },
    );
  });

  it('getCustomObject', () => {
    const customObjectName = 'any';
    const customObject = { anyField: 'anyValue' };
    clientWrapperUnderTest = new ClientWrapper(metadata, marketoConstructorStub);
    clientWrapperUnderTest.getCustomObject(customObjectName);

    expect(marketoClientStub._connection.get).to.have.been.calledWith(
      `/v1/customobjects/${customObjectName}/describe.json`,
      { query: { _method: 'GET' } },
    );
  });

  it('queryCustomObject(mutiple searchFields)', async () => {
    const customObjectName = 'any';
    const filterType = 'anyFilterType';
    const searchFields = [{ anySearchField: 'anySearchFieldValue' }];
    const requestFields = ['anyField'];
    clientWrapperUnderTest = new ClientWrapper(metadata, marketoConstructorStub);
    clientWrapperUnderTest.customObjectDescriptions = {
      [customObjectName]: {result: [{fields: requestFields.map(f => {return {name: f}})}]},
    },
    await clientWrapperUnderTest.queryCustomObject(customObjectName, filterType, searchFields);

    expect(marketoClientStub._connection.postJson).to.have.been.calledWith(
      `/v1/customobjects/${customObjectName}.json`,
      {
        filterType: `${filterType}`,
        fields: requestFields,
        input: searchFields,
      },
      {
        query: {
          _method: 'GET' ,
        },
      },
    );
  });

  it('queryCustomObject(single searchFields)', async () => {
    const customObjectName = 'any';
    const filterType = 'anyFilterType';
    const searchFields = ['anySearchFieldValue'];
    const requestFields = ['anyField'];
    clientWrapperUnderTest = new ClientWrapper(metadata, marketoConstructorStub);
    clientWrapperUnderTest.customObjectDescriptions = {
      [customObjectName]: {result: [{fields: requestFields.map(f => {return {name: f}})}]},
    },
    await clientWrapperUnderTest.queryCustomObject(customObjectName, filterType, searchFields);

    expect(marketoClientStub._connection.get).to.have.been.calledWith(
      `/v1/customobjects/${customObjectName}.json?filterType=${filterType}&filterValues=${searchFields.join(',')}&fields=${requestFields.join(',')}`,
    );
  });

  it('deleteCustomObjectById', () => {
    const customObjectName = 'any';
    const customObjectGUID = 'anyGUID';
    clientWrapperUnderTest = new ClientWrapper(metadata, marketoConstructorStub);
    clientWrapperUnderTest.deleteCustomObjectById(customObjectName, customObjectGUID);

    expect(marketoClientStub._connection.postJson).to.have.been.calledWith(
      `/v1/customobjects/${customObjectName}/delete.json`,
      {
        deleteBy: 'idField',
        input: [{
          marketoGUID: customObjectGUID,
        }],
      },
    );
  });

  it('getActivityTypes', () => {
    clientWrapperUnderTest = new ClientWrapper(metadata, marketoConstructorStub);
    clientWrapperUnderTest.getActivityTypes();

    expect(marketoClientStub.activities.getActivityTypes).to.have.been.calledWith();
  });

  it('getActivityPagingToken', () => {
    const sinceDate = 'anyDate';
    clientWrapperUnderTest = new ClientWrapper(metadata, marketoConstructorStub);
    clientWrapperUnderTest.getActivityPagingToken(sinceDate);

    expect(marketoClientStub._connection.get).to.have.been.calledWith(
      `/v1/activities/pagingtoken.json?sinceDatetime=${sinceDate}`,
    );
  });

  it('getActivities', () => {
    const nextPageToken = 'anyToken';
    const leadId = 'anyId';
    const activityId = 'anyActivityId';
    clientWrapperUnderTest = new ClientWrapper(metadata, marketoConstructorStub);
    clientWrapperUnderTest.getActivities(nextPageToken, leadId, activityId);

    expect(marketoClientStub._connection.get).to.have.been.calledWith('/v1/activities.json', {
      query: {
        nextPageToken,
        leadIds: leadId,
        activityTypeIds: activityId,
      },
    });
  });

  it('getDailyApiUsage', () => {
    clientWrapperUnderTest = new ClientWrapper(metadata, marketoConstructorStub);
    clientWrapperUnderTest.getDailyApiUsage();

    expect(marketoClientStub._connection.get).to.have.been.calledWith('/v1/stats/usage.json');
  });
});
