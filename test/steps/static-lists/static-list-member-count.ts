import { Struct } from 'google-protobuf/google/protobuf/struct_pb';
import * as chai from 'chai';
import { default as sinon } from 'ts-sinon';
import * as sinonChai from 'sinon-chai';
import 'mocha';

import { Step as ProtoStep, StepDefinition, FieldDefinition, RunStepResponse } from '../../../src/proto/cog_pb';
import { Step } from '../../../src/steps/static-lists/static-list-member-count';

chai.use(sinonChai);

describe('StaticListMemberCountStep', () => {
  const expect = chai.expect;
  let protoStep: ProtoStep;
  let stepUnderTest: Step;
  let clientWrapperStub: any;

  beforeEach(() => {
    protoStep = new ProtoStep();
    clientWrapperStub = sinon.stub();
    clientWrapperStub.findStaticListsByName = sinon.stub();
    clientWrapperStub.findStaticListsMembershipByListId = sinon.stub();
    stepUnderTest = new Step(clientWrapperStub);
  });

  it('should return expected step metadata', () => {
    const stepDef: StepDefinition = stepUnderTest.getDefinition();
    expect(stepDef.getStepId()).to.equal('StaticListMemberCountStep');
    expect(stepDef.getName()).to.equal('Count a Marketo Static List');
    expect(stepDef.getExpression()).to.equal('check the number of members from marketo static list (?<staticListName>.+)');
    expect(stepDef.getType()).to.equal(StepDefinition.Type.VALIDATION);
  });

  it('should return expected step fields', () => {
    const stepDef: StepDefinition = stepUnderTest.getDefinition();
    const fields: any[] = stepDef.getExpectedFieldsList().map((field: FieldDefinition) => {
      return field.toObject();
    });

    // Static List Name field
    expect(fields[0].key).to.equal('staticListName');
    expect(fields[0].optionality).to.equal(FieldDefinition.Optionality.REQUIRED);
    expect(fields[0].type).to.equal(FieldDefinition.Type.STRING);
  });

  it('should respond with an error if the marketo client throws an error', async () => {
    const expectedStaticListName: string = 'firstName';
    protoStep.setData(Struct.fromJavaScript({
      staticListName: expectedStaticListName,
    }));

    // Cause the client to throw an error, and execute the step.
    clientWrapperStub.findStaticListsByName.throws('any error');
    const response: RunStepResponse = (await stepUnderTest.executeStep(protoStep)) as RunStepResponse;
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

  it('should respond with an error if the marketo client did not find a static list', async () => {
    const expectedStaticListName: string = 'firstName';
    protoStep.setData(Struct.fromJavaScript({
      staticListName: expectedStaticListName,
    }));

    // Have the client respond with no leads.
    clientWrapperStub.findStaticListsByName.returns(Promise.resolve({
      success: true,
      result: [],
    }));

    const response: RunStepResponse = (await stepUnderTest.executeStep(protoStep)) as RunStepResponse;
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

  it('should respond with a pass if the staticList is found', async () => {
    const expectedStaticListName: string = 'firstName';
    protoStep.setData(Struct.fromJavaScript({
      staticListName: expectedStaticListName,
    }));

    // Have the client respond with a valid, but mismatched lead.
    clientWrapperStub.findStaticListsByName.returns(Promise.resolve({
      success: true,
      result: [{
        id: 'anyId',
        name: 'anyName',
      }],
    }));

    clientWrapperStub.findStaticListsMembershipByListId.returns(Promise.resolve({
      success: true,
      result: [{
        fields: [{
          id: 'anyId',
          name: 'anyFieldName',
        }]
      }],
    }));

    const response: RunStepResponse = (await stepUnderTest.executeStep(protoStep)) as RunStepResponse;
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });

  it('should respond with a error if the staticList members get not success', async () => {
    const expectedStaticListName: string = 'firstName';
    protoStep.setData(Struct.fromJavaScript({
      staticListName: expectedStaticListName,
    }));

    // Have the client respond with a valid, but mismatched lead.
    clientWrapperStub.findStaticListsByName.returns(Promise.resolve({
      success: true,
      result: [{
        id: 'anyId',
        name: 'anyName',
      }],
    }));

    clientWrapperStub.findStaticListsMembershipByListId.returns(Promise.resolve({
      success: false,
      result: [{
        fields: [{
          id: 'anyId',
          name: 'anyFieldName',
        }]
      }],
    }));

    const response: RunStepResponse = (await stepUnderTest.executeStep(protoStep)) as RunStepResponse;
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });
});
