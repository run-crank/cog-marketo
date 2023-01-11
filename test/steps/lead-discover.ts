import { Struct } from 'google-protobuf/google/protobuf/struct_pb';
import * as chai from 'chai';
import { default as sinon } from 'ts-sinon';
import * as sinonChai from 'sinon-chai';
import 'mocha';

import { Step as ProtoStep, StepDefinition, FieldDefinition, RunStepResponse } from '../../src/proto/cog_pb';
import { Step } from '../../src/steps/lead-discover';

chai.use(sinonChai);

describe('DiscoverLeadStep', () => {
  const expect = chai.expect;
  let protoStep: ProtoStep;
  let stepUnderTest: Step;
  let clientWrapperStub: any;

  beforeEach(() => {
    protoStep = new ProtoStep();
    clientWrapperStub = sinon.stub();
    clientWrapperStub.findLeadByField = sinon.stub();
    stepUnderTest = new Step(clientWrapperStub);
  });

  it('should return expected step metadata', () => {
    const stepDef: StepDefinition = stepUnderTest.getDefinition();
    expect(stepDef.getStepId()).to.equal('DiscoverLead');
    expect(stepDef.getName()).to.equal('Discover fields on a Marketo lead');
    expect(stepDef.getExpression()).to.equal('discover fields on marketo lead (?<email>.+)');
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

    // Partition ID field
    expect(fields[1].key).to.equal('partitionId');
    expect(fields[1].optionality).to.equal(FieldDefinition.Optionality.OPTIONAL);
    expect(fields[1].type).to.equal(FieldDefinition.Type.NUMERIC);
  });

  it('should call the client wrapper with the expected args', async () => {
    const expectedEmail: string = 'expected@example.com';
    const expectedPartitionId: number = 3;
    protoStep.setData(Struct.fromJavaScript({
      email: expectedEmail,
      partitionId: expectedPartitionId,
    }));

    await stepUnderTest.executeStep(protoStep);
    expect(clientWrapperStub.findLeadByField).to.have.been.calledWith(
      'email',
      expectedEmail,
      sinon.match.any,
      expectedPartitionId,
    );
  });

  it('should respond with an error if the marketo client throws an error', async () => {
    // Cause the client to throw an error, and execute the step.
    clientWrapperStub.findLeadByField.throws('any error');
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

  it('should respond with a failure if the marketo client did not find a lead', async () => {
    protoStep.setData(Struct.fromJavaScript({
      email: 'anyone@example.com',
      partitionId: 3
    }));
    // Have the client respond with no leads.
    clientWrapperStub.findLeadByField.returns(Promise.resolve({
      success: true,
      result: [],
    }));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.FAILED);
  });

  it("should respond with a pass if the lead was discovered", async () => {
    protoStep.setData(Struct.fromJavaScript({
      email: 'anyone@example.com',
    }));

    // Have the client respond with a valid lead
    clientWrapperStub.findLeadByField.returns(Promise.resolve({
      success: true,
      result: [{
        firstName: 'example',
      }],
    }));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });
});
