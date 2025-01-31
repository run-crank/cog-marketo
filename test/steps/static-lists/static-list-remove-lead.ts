import { Struct } from 'google-protobuf/google/protobuf/struct_pb';
import * as chai from 'chai';
import { default as sinon } from 'ts-sinon';
import * as sinonChai from 'sinon-chai';
import 'mocha';

import { Step as ProtoStep, StepDefinition, RunStepResponse, FieldDefinition } from '../../../src/proto/cog_pb';
import { Step } from '../../../src/steps/static-lists/static-list-remove-lead';

chai.use(sinonChai);

describe('RemoveLeadToStaticListStep', () => {
  const expect = chai.expect;
  let protoStep: ProtoStep;
  let stepUnderTest: Step;
  let clientWrapperStub: any;

  beforeEach(() => {
    protoStep = new ProtoStep();
    clientWrapperStub = sinon.stub();
    clientWrapperStub.findStaticListsByName = sinon.stub();
    clientWrapperStub.removeLeadToStaticList = sinon.stub();
    stepUnderTest = new Step(clientWrapperStub);
  });

  it('should return expected step metadata', () => {
    const stepDef: StepDefinition = stepUnderTest.getDefinition();
    expect(stepDef.getStepId()).to.equal('RemoveLeadToStaticListStep');
    expect(stepDef.getName()).to.equal('Remove Marketo leads from static list');
    expect(stepDef.getExpression()).to.equal('remove marketo leads from static list (?<staticListName>.+)');
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
    expect(fields[1].key).to.equal('programId');
    expect(fields[1].optionality).to.equal(FieldDefinition.Optionality.OPTIONAL);
    expect(fields[1].type).to.equal(FieldDefinition.Type.NUMERIC);

    // leadIds field
    expect(fields[2].key).to.equal('leadIds');
    expect(fields[2].optionality).to.equal(FieldDefinition.Optionality.REQUIRED);
    expect(fields[2].type).to.equal(FieldDefinition.Type.STRING);
  });

  it('should respond with success step executes successfully', async () => {
    clientWrapperStub.findStaticListsByName.returns(Promise.resolve({
      success: true,
      result: [{
        id: 'anyId',
        name: 'anyName',
      }],
    }));
    clientWrapperStub.removeLeadToStaticList.returns(Promise.resolve({
      success: true,
      result: [{
          id: 'anyId',
          status: 'removed',
      }],
    }));
    protoStep.setData(Struct.fromJavaScript({
      staticListName: 'someEmail',
      leadIds: 'anyId, anyId, anyId',
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });

  it('should respond with fail if at least 1 of the leads was not removed', async () => {
    clientWrapperStub.findStaticListsByName.returns(Promise.resolve({
      success: true,
      result: [{
        id: 'anyId',
        name: 'anyName',
      }],
    }));
    clientWrapperStub.removeLeadToStaticList.returns(Promise.resolve({
      success: true,
      result: [{
          id: 'anyId',
          status: 'removed',
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
    clientWrapperStub.removeLeadToStaticList.returns(Promise.resolve({
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
