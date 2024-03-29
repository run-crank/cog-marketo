import { Struct } from 'google-protobuf/google/protobuf/struct_pb';
import * as chai from 'chai';
import { default as sinon } from 'ts-sinon';
import * as sinonChai from 'sinon-chai';
import 'mocha';

import { Step as ProtoStep, StepDefinition, RunStepResponse, FieldDefinition } from '../../src/proto/cog_pb';
import { Step } from '../../src/steps/smart-campaign-add-lead';

chai.use(sinonChai);

describe('AddLeadToSmartCampaignStep', () => {
  const expect = chai.expect;
  let protoStep: ProtoStep;
  let stepUnderTest: Step;
  let clientWrapperStub: any;

  describe('Single Lead', () => {

    beforeEach(() => {
      protoStep = new ProtoStep();
      clientWrapperStub = sinon.stub();
      clientWrapperStub.getCampaigns = sinon.stub();
      clientWrapperStub.findLeadByField = sinon.stub();
      clientWrapperStub.addLeadToSmartCampaign = sinon.stub();
      stepUnderTest = new Step(clientWrapperStub);
    });

    it('should return expected step metadata', () => {
      const stepDef: StepDefinition = stepUnderTest.getDefinition();
      expect(stepDef.getStepId()).to.equal('AddLeadToSmartCampaignStep');
      expect(stepDef.getName()).to.equal('Add Marketo lead to smart campaign');
      expect(stepDef.getExpression()).to.equal('add the (?<email>.+) marketo lead to smart campaign (?<campaign>.+)');
      expect(stepDef.getType()).to.equal(StepDefinition.Type.ACTION);
    });

    it('should return expected step fields', () => {
      const stepDef: StepDefinition = stepUnderTest.getDefinition();
      const fields: any[] = stepDef.getExpectedFieldsList().map((field: FieldDefinition) => {
        return field.toObject();
      });

      // Email field
      expect(fields[0].key).to.equal('email');
      expect(fields[0].optionality).to.equal(FieldDefinition.Optionality.REQUIRED);
      expect(fields[0].type).to.equal(FieldDefinition.Type.STRING);

      // Campaign field
      expect(fields[1].key).to.equal('campaign');
      expect(fields[1].optionality).to.equal(FieldDefinition.Optionality.REQUIRED);
      expect(fields[1].type).to.equal(FieldDefinition.Type.ANYSCALAR);

      // Partition ID field
      expect(fields[2].key).to.equal('partitionId');
      expect(fields[2].optionality).to.equal(FieldDefinition.Optionality.OPTIONAL);
      expect(fields[2].type).to.equal(FieldDefinition.Type.NUMERIC);
    });

    it('should respond with success if the marketo executes succesfully with non numeric campaign', async () => {
      const expectedResponseMessage: string = 'Successfully added lead %s to smart campaign %s';
      clientWrapperStub.getCampaigns.returns(Promise.resolve([
        {
          name: 'someCampaign',
          id: '11111',
          isRequestable: true,
        },
      ]));
      clientWrapperStub.findLeadByField.returns(Promise.resolve({
        success: true,
        result: [
          {
            name: 'someLead',
            email: 'someEmail',
          },
        ],
      }));
      clientWrapperStub.addLeadToSmartCampaign.returns(Promise.resolve({
        success: true,
        result: [{}],
      }));
      protoStep.setData(Struct.fromJavaScript({
        email: 'someEmail',
        campaign: 'someCampaign',
      }));
      const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
      expect(response.getMessageFormat()).to.equal(expectedResponseMessage);
      expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
    });

    it('should respond with success if the marketo executes succesfully with numeric campaign', async () => {
      const expectedResponseMessage: string = 'Successfully added lead %s to smart campaign %s';
      clientWrapperStub.getCampaigns.returns(Promise.resolve([
        {
          name: 'someCampaign',
          id: '11111',
          isRequestable: true,
        },
      ]));
      clientWrapperStub.findLeadByField.returns(Promise.resolve({
        success: true,
        result: [
          {
            name: 'someLead',
            email: 'someEmail',
          },
        ],
      }));
      clientWrapperStub.addLeadToSmartCampaign.returns(Promise.resolve({
        success: true,
        result: [{}],
      }));
      protoStep.setData(Struct.fromJavaScript({
        email: 'someEmail',
        campaign: '11111',
      }));
      const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
      expect(response.getMessageFormat()).to.equal(expectedResponseMessage);
      expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
    });

    it('should respond with error if the marketo returns more than 1 campaign', async () => {
      const expectedResponseMessage: string = "Can't add lead(s) to %s: found %d matching campaigns";
      clientWrapperStub.getCampaigns.returns(Promise.resolve([
        {
          name: 'someCampaign',
          id: '11111',
          isRequestable: true,
        },
        {
          name: 'someCampaign',
          id: '22222',
          isRequestable: true,
        },
      ]));
      protoStep.setData(Struct.fromJavaScript({
        email: 'someEmail',
        campaign: 'someCampaign',
      }));
      const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
      expect(response.getMessageFormat()).to.equal(expectedResponseMessage);
      expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
    });

    it('should respond with an error if the marketo throws an error related to trigger campaign', async () => {
      const expectedResponseMessage: string = "Cannot add lead to smart campaign %s. In order to test this campaign, you must add a 'Campaign is Requested' trigger with 'Source' set to 'Web Service API'";
      clientWrapperStub.getCampaigns.returns(Promise.resolve([
        {
          name: 'someCampaign',
          id: '11111',
        },
      ]));
      clientWrapperStub.findLeadByField.returns(Promise.resolve({
        success: true,
        result: [
          {
            name: 'someLead',
            email: 'someEmail',
          },
        ],
      }));
      clientWrapperStub.addLeadToSmartCampaign.throws({ message: "Trigger campaign needs to have a 'Campaign Requested' trigger" });
      protoStep.setData(Struct.fromJavaScript({
        email: 'someEmail',
        campaign: 'someCampaign',
      }));
      const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
      expect(response.getMessageFormat()).to.equal(expectedResponseMessage);
      expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
    });

    it('should respond with fail if the marketo fails to add lead to smart campaign', async () => {
      const expectedResponseMessage: string = 'Unable to add lead %s to smart campaign %s: %s';
      clientWrapperStub.getCampaigns.returns(Promise.resolve([
        {
          name: 'someCampaign',
          id: '11111',
          isRequestable: true,
        },
      ]));
      clientWrapperStub.findLeadByField.returns(Promise.resolve({
        success: true,
        result: [
          {
            name: 'someLead',
            email: 'someEmail',
          },
        ],
      }));
      clientWrapperStub.addLeadToSmartCampaign.returns(Promise.resolve({
        success: false,
        result: [{}],
        message: 'someError',
      }));
      protoStep.setData(Struct.fromJavaScript({
        email: 'someEmail',
        campaign: 'someCampaign',
      }));
      const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
      expect(response.getMessageFormat()).to.equal(expectedResponseMessage);
      expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.FAILED);
    });

    it('should respond with an error if the marketo throws an error', async () => {
      clientWrapperStub.getCampaigns.returns([]);
      protoStep.setData(Struct.fromJavaScript({
        email: 'someEmail',
        campaign: 'someCampaign',
      }));
      const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
      expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
    });

  });
  
  describe('Bulk Leads', () => {

    beforeEach(() => {
      protoStep = new ProtoStep();
      clientWrapperStub = sinon.stub();
      clientWrapperStub.getCampaigns = sinon.stub();
      clientWrapperStub.bulkFindLeadsByEmail = sinon.stub();
      clientWrapperStub.bulkAddLeadToSmartCampaign = sinon.stub();
      stepUnderTest = new Step(clientWrapperStub);
    });

    it('should respond with passed if multiple leads are succesfully added', async () => {
      const expectedResponseMessage: string = 'Successfully added %d leads to smart campaign %s';
      clientWrapperStub.getCampaigns.returns(Promise.resolve([
        {
          name: 'someCampaign',
          id: '11111',
          isRequestable: true,
        },
      ]));
      clientWrapperStub.bulkFindLeadsByEmail.returns(Promise.resolve({
        success: true,
        result: [
          {
            name: 'firstLead',
            email: 'firstEmail',
            id: '1'
          },
          {
            name: 'secondLead',
            email: 'secondEmail',
            id: '2'
          },
        ],
      }));
      clientWrapperStub.bulkAddLeadToSmartCampaign.returns(Promise.resolve({
        passedLeads: ['1', '2'],
        failedLeads: {}
      }));
      protoStep.setData(Struct.fromJavaScript({
        campaign: 'someCampaign',
        multiple_email: ['firstEmail', 'secondEmail']
      }));
      const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
      expect(response.getMessageFormat()).to.equal(expectedResponseMessage);
      expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
    });
    
    it('should respond with passed if multiple leads are succesfully added using ID', async () => {
      const expectedResponseMessage: string = 'Successfully added %d leads to smart campaign %s';
      clientWrapperStub.getCampaigns.returns(Promise.resolve([
        {
          name: 'someCampaign',
          id: '11111',
          isRequestable: true,
        },
      ]));
      clientWrapperStub.bulkAddLeadToSmartCampaign.returns(Promise.resolve({
        passedLeads: ['1', '2'],
        failedLeads: {}
      }));
      protoStep.setData(Struct.fromJavaScript({
        campaign: 'someCampaign',
        multiple_email: [1,2]
      }));
      const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
      expect(response.getMessageFormat()).to.equal(expectedResponseMessage);
      expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
    });

    it('should respond with fail if only some leads are succesfully added', async () => {
      const expectedResponseMessage: string = 'Successfully added %d out of %d leads to smart campaign %s';
      clientWrapperStub.getCampaigns.returns(Promise.resolve([
        {
          name: 'someCampaign',
          id: '11111',
          isRequestable: true,
        },
      ]));
      clientWrapperStub.bulkFindLeadsByEmail.returns(Promise.resolve({
        success: true,
        result: [
          {
            name: 'firstLead',
            email: 'firstEmail',
            id: '1'
          },
          {
            name: 'secondLead',
            email: 'secondEmail',
            id: '2'
          },
        ],
      }));
      clientWrapperStub.bulkAddLeadToSmartCampaign.returns(Promise.resolve({
        passedLeads: ['1'],
        failedLeads: {'2': 'lead 2 not found'}
      }));
      protoStep.setData(Struct.fromJavaScript({
        campaign: 'someCampaign',
        multiple_email: ['firstEmail', 'secondEmail']
      }));
      const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
      expect(response.getMessageFormat()).to.equal(expectedResponseMessage);
      expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.FAILED);
    });

    it('should respond with failed if no leads are successfully added', async () => {
      const expectedResponseMessage: string = 'Failed to add %d leads to smart campaign %s';
      clientWrapperStub.getCampaigns.returns(Promise.resolve([
        {
          name: 'someCampaign',
          id: '11111',
          isRequestable: true,
        },
      ]));
      clientWrapperStub.bulkFindLeadsByEmail.returns(Promise.resolve({
        success: true,
        result: [
          {
            name: 'firstLead',
            email: 'firstEmail',
            id: '1'
          },
          {
            name: 'secondLead',
            email: 'secondEmail',
            id: '2'
          },
        ],
      }));
      clientWrapperStub.bulkAddLeadToSmartCampaign.returns(Promise.resolve({
        passedLeads: [],
        failedLeads: {'1': 'lead 1 not found', '2': 'lead 2 not found'}
      }));
      protoStep.setData(Struct.fromJavaScript({
        campaign: 'someCampaign',
        multiple_email: ['firstEmail', 'secondEmail']
      }));
      const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
      expect(response.getMessageFormat()).to.equal(expectedResponseMessage);
      expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.FAILED);
    });

    it('should respond with error if not all leads are found', async () => {
      const expectedResponseMessage: string = 'Could not find all leads provided in partition %d';
      clientWrapperStub.getCampaigns.returns(Promise.resolve([
        {
          name: 'someCampaign',
          id: '11111',
          isRequestable: true,
        },
      ]));
      clientWrapperStub.bulkFindLeadsByEmail.returns(Promise.resolve([{
        success: true,
        result: [
          {
            name: 'secondLead',
            email: 'secondEmail',
            id: '2'
          },
        ],
      }]));
      protoStep.setData(Struct.fromJavaScript({
        campaign: 'someCampaign',
        multiple_email: ['firstEmail@example.com', 'secondEmail@example.com']
      }));
      const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
      expect(response.getMessageFormat()).to.equal(expectedResponseMessage);
      expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
    });
  });
})
