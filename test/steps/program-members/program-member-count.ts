import { Struct } from 'google-protobuf/google/protobuf/struct_pb';
import * as chai from 'chai';
import { default as sinon } from 'ts-sinon';
import * as sinonChai from 'sinon-chai';
import 'mocha';

import { Step as ProtoStep, StepDefinition, FieldDefinition, RunStepResponse } from '../../../src/proto/cog_pb';
import { Step } from '../../../src/steps/program-members/program-member-count';

chai.use(sinonChai);

describe('ProgramMemberCountStep', () => {
  const expect = chai.expect;
  let protoStep: ProtoStep;
  let stepUnderTest: Step;
  let clientWrapperStub: any;

  beforeEach(() => {
    protoStep = new ProtoStep();
    clientWrapperStub = sinon.stub();
    clientWrapperStub.findProgramsByName = sinon.stub();
    clientWrapperStub.getProgramMembersFields = sinon.stub();
    clientWrapperStub.getProgramMembersByFilterValue = sinon.stub();
    stepUnderTest = new Step(clientWrapperStub);
  });

  it('should return expected step metadata', () => {
    const stepDef: StepDefinition = stepUnderTest.getDefinition();
    expect(stepDef.getStepId()).to.equal('ProgramMemberCountStep');
    expect(stepDef.getName()).to.equal('Count a Marketo Program');
    expect(stepDef.getExpression()).to.equal('check the number of members from marketo program (?<programName>.+)');
    expect(stepDef.getType()).to.equal(StepDefinition.Type.VALIDATION);
  });

  it('should return expected step fields', () => {
    const stepDef: StepDefinition = stepUnderTest.getDefinition();
    const fields: any[] = stepDef.getExpectedFieldsList().map((field: FieldDefinition) => {
      return field.toObject();
    });

    // Static List Name field
    expect(fields[0].key).to.equal('programName');
    expect(fields[0].optionality).to.equal(FieldDefinition.Optionality.REQUIRED);
    expect(fields[0].type).to.equal(FieldDefinition.Type.STRING);
  });

  it('should respond with an error if the marketo client throws an error', async () => {
    const expectedProgramName: string = 'firstName';
    protoStep.setData(Struct.fromJavaScript({
      programName: expectedProgramName,
    }));

    // Cause the client to throw an error, and execute the step.
    clientWrapperStub.findProgramsByName.throws('any error');
    const response: RunStepResponse = (await stepUnderTest.executeStep(protoStep)) as RunStepResponse;
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

  it('should respond with an error if the marketo client did not find a program', async () => {
    const expectedProgramName: string = 'firstName';
    protoStep.setData(Struct.fromJavaScript({
      programName: expectedProgramName,
    }));

    // Have the client respond with no leads.
    clientWrapperStub.findProgramsByName.returns(Promise.resolve({
      success: true,
      result: [],
    }));

    const response: RunStepResponse = (await stepUnderTest.executeStep(protoStep)) as RunStepResponse;
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

  it('should respond with a pass if the program is found', async () => {
    const expectedProgramName: string = 'firstName';
    protoStep.setData(Struct.fromJavaScript({
      programName: expectedProgramName,
    }));

    // Have the client respond with a valid, but mismatched lead.
    clientWrapperStub.findProgramsByName.returns(Promise.resolve({
      success: true,
      result: [{
        id: 'anyId',
        name: 'anyName',
      }],
    }));

    clientWrapperStub.getProgramMembersFields.returns(Promise.resolve({
      success: true,
      result: [{
        fields: [{
          name: 'anyFieldName',
        }]
      }],
    }));

    clientWrapperStub.getProgramMembersByFilterValue.returns(Promise.resolve({
      success: true,
      result: [{
        id: 'anyId',
        firstName: 'anyName',
      }],
    }));

    const response: RunStepResponse = (await stepUnderTest.executeStep(protoStep)) as RunStepResponse;
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });

  it('should respond with a error if the program members get not success', async () => {
    const expectedProgramName: string = 'firstName';
    protoStep.setData(Struct.fromJavaScript({
      programName: expectedProgramName,
    }));

    // Have the client respond with a valid, but mismatched lead.
    clientWrapperStub.findProgramsByName.returns(Promise.resolve({
      success: true,
      result: [{
        id: 'anyId',
        name: 'anyName',
      }],
    }));

    clientWrapperStub.getProgramMembersFields.returns(Promise.resolve({
      success: true,
      result: [{
        fields: [{
          name: 'anyFieldName',
        }]
      }],
    }));

    clientWrapperStub.getProgramMembersByFilterValue.returns(Promise.resolve({
      success: false,
      result: [{
        id: 'anyId',
        firstName: 'anyName',
      }],
    }));

    const response: RunStepResponse = (await stepUnderTest.executeStep(protoStep)) as RunStepResponse;
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });
});
