import { Struct } from 'google-protobuf/google/protobuf/struct_pb';
import * as chai from 'chai';
import { default as sinon } from 'ts-sinon';
import * as sinonChai from 'sinon-chai';
import 'mocha';

import { Step as ProtoStep, StepDefinition, RunStepResponse, FieldDefinition } from '../../../src/proto/cog_pb';
import { Step } from '../../../src/steps/static-lists/static-list-add-lead';

chai.use(sinonChai);

describe('AddLeadToStaticListStep', () => {
  const expect = chai.expect;
  let protoStep: ProtoStep;
  let stepUnderTest: Step;
  let clientWrapperStub: any;

  beforeEach(() => {
    protoStep = new ProtoStep();
    clientWrapperStub = sinon.stub();
    clientWrapperStub.findStaticListsByName = sinon.stub();
    clientWrapperStub.addLeadToStaticList = sinon.stub();
    stepUnderTest = new Step(clientWrapperStub);
  });

  it('should return expected step metadata', () => {
    const stepDef: StepDefinition = stepUnderTest.getDefinition();
    expect(stepDef.getStepId()).to.equal('AddLeadToStaticListStep');
    expect(stepDef.getName()).to.equal('Add Marketo Leads to Static List');
    expect(stepDef.getExpression()).to.equal('add marketo leads to static list (?<staticListName>.+)');
    expect(stepDef.getType()).to.equal(StepDefinition.Type.ACTION);
  });

  it('should return expected step fields', () => {
    const stepDef: StepDefinition = stepUnderTest.getDefinition();
    const fields: any[] = stepDef.getExpectedFieldsList().map((field: FieldDefinition) => {
      return field.toObject();
    });

    // staticListName field
    expect(fields[0].key).to.equal('staticListName');
    expect(fields[0].optionality).to.equal(FieldDefinition.Optionality.REQUIRED);
    expect(fields[0].type).to.equal(FieldDefinition.Type.STRING);

    // leadIds field
    expect(fields[1].key).to.equal('leadIds');
    expect(fields[1].optionality).to.equal(FieldDefinition.Optionality.REQUIRED);
    expect(fields[1].type).to.equal(FieldDefinition.Type.STRING);
  });

  it('should respond with success step executes successfully', async () => {
    clientWrapperStub.findStaticListsByName.returns(Promise.resolve({
      success: true,
      result: [{
        id: 'anyId',
        name: 'anyName',
      }],
    }));
    clientWrapperStub.addLeadToStaticList.returns(Promise.resolve({
      success: true,
      result: [{
          id: 'anyId',
          status: 'added',
      }],
    }));
    protoStep.setData(Struct.fromJavaScript({
      staticListName: 'someEmail',
      leadIds: 'anyId, anyId, anyId',
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });

  it('should respond with fail if at least 1 of the leads was not added', async () => {
    clientWrapperStub.findStaticListsByName.returns(Promise.resolve({
      success: true,
      result: [{
        id: 'anyId',
        name: 'anyName',
      }],
    }));
    clientWrapperStub.addLeadToStaticList.returns(Promise.resolve({
      success: true,
      result: [{
          id: 'anyId',
          status: 'added',
      }, {
        id: 'anyId',
        status: 'skipped',
        reason: [{
          code: 'anyCode',
          message: 'anyMessage'
        }]
    }],
    }));
    protoStep.setData(Struct.fromJavaScript({
      staticListName: 'someEmail',
      leadIds: 'anyId, anyId, anyId',
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.FAILED);
  });

  it('should respond with error if the static list does not exist', async () => {
    clientWrapperStub.findStaticListsByName.returns(Promise.resolve({
      success: true,
      result: [],
    }));
    protoStep.setData(Struct.fromJavaScript({
      staticListName: 'someEmail',
      leadIds: 'anyId, anyId, anyId',
    }));
    
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

  it('should respond with error if the marketo call was not successful', async () => {
    clientWrapperStub.findStaticListsByName.returns(Promise.resolve({
      success: true,
      result: [{
        id: 'anyId',
        name: 'anyName',
      }],
    }));
    clientWrapperStub.addLeadToStaticList.returns(Promise.resolve({
      success: false,
    }));
    protoStep.setData(Struct.fromJavaScript({
      staticListName: 'someEmail',
      leadIds: 'anyId, anyId, anyId',
    }));
    
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

  it('should respond with an error if the marketo throws an error', async () => {
    clientWrapperStub.findStaticListsByName.throws('any error');
    protoStep.setData(Struct.fromJavaScript({
      staticListName: 'someEmail',
      leadIds: 'anyId, anyId, anyId',
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

});
