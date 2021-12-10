import { Struct } from 'google-protobuf/google/protobuf/struct_pb';
import * as chai from 'chai';
import { default as sinon } from 'ts-sinon';
import * as sinonChai from 'sinon-chai';
import 'mocha';

import { Step as ProtoStep, StepDefinition, RunStepResponse } from '../../../src/proto/cog_pb';
import { Step } from '../../../src/steps/programs/program-create-cost';

chai.use(sinonChai);

describe('CreateProgramCostStep', () => {
  const expect = chai.expect;
  let protoStep: ProtoStep;
  let stepUnderTest: Step;
  let clientWrapperStub: any;

  beforeEach(() => {
    protoStep = new ProtoStep();
    clientWrapperStub = sinon.stub();
    clientWrapperStub.findProgramsByName = sinon.stub();
    clientWrapperStub.updateProgram = sinon.stub();
    stepUnderTest = new Step(clientWrapperStub);
  });

  it('should return expected step metadata', () => {
    const stepDef: StepDefinition = stepUnderTest.getDefinition();
    expect(stepDef.getStepId()).to.equal('CreateProgramCostStep');
    expect(stepDef.getName()).to.equal('Create Cost for Marketo Program Cost');
    expect(stepDef.getExpression()).to.equal('create cost for marketo program');
    expect(stepDef.getType()).to.equal(StepDefinition.Type.ACTION);
  });

  it('should call the client wrapper with the expected args', async () => {
    const sampleInputs = {
      name: 'sampleName',
      startDate: '12/01/01',
      cost: 1000,
      note: 'sampleNot',
    }
    protoStep.setData(Struct.fromJavaScript(sampleInputs));

    clientWrapperStub.findProgramsByName.returns(Promise.resolve({
      success: true,
      result: [
        {
          status: 'success',
          id: 123321,
          name: 'sampleName',
        },
      ],
    }));

    await stepUnderTest.executeStep(protoStep);
    expect(clientWrapperStub.findProgramsByName).to.have.been.calledWith(
      protoStep.getData().toJavaScript().name,
    );
    expect(clientWrapperStub.updateProgram).to.have.been.calledWith(
      123321, `costs=[{"startDate":"2001-12-01","cost":${sampleInputs.cost},"note":"${sampleInputs.note}"}]`
    );
  });

  it('should respond with success if the marketo executes succesfully', async () => {
    const expectedName: string = 'expected@example.com';
    const expectedReason: string = 'reason it failed';

    clientWrapperStub.findProgramsByName.returns(Promise.resolve({
      success: true,
      result: [
        {
          status: 'success',
          id: 123321,
          name: 'sampleName',
        },
      ],
    }));

    clientWrapperStub.updateProgram.returns(Promise.resolve({
      success: true,
      result: [
        {
          status: 'success',
          id: 123321,
          name: 'sampleName',
        },
      ],
    }));
    protoStep.setData(Struct.fromJavaScript({
      name: 'sampleName',
      startDate: '12/01/01',
      cost: 1000,
      note: 'sampleNot',
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });

  it('should respond with fail if the marketo skips creation of program', async () => {
    const expectedMessage: string  = 'status was skipped';
    
    clientWrapperStub.findProgramsByName.returns(Promise.resolve({
      success: true,
      result: [
        {
          status: 'success',
          id: 123321,
          name: 'sampleName',
        },
      ],
    }));

    clientWrapperStub.updateProgram.returns(Promise.resolve({
      success: true,
      result: [
        {
          status: 'skipped',
        },
      ],
    }));
    protoStep.setData(Struct.fromJavaScript({
      name: 'sampleName',
      startDate: '12/01/01',
      cost: 1000,
      note: 'sampleNot',
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.FAILED);
    expect(response.getMessageArgsList()[0].getStringValue()).to.equal(expectedMessage);
  });

  it('should respond with an error if the marketo throws an error', async () => {
    clientWrapperStub.findProgramsByName.returns(Promise.resolve({
      success: true,
      result: [
        {
          status: 'success',
          id: 123321,
          name: 'sampleName',
        },
      ],
    }));

    clientWrapperStub.updateProgram.throws('any error');
    protoStep.setData(Struct.fromJavaScript({
      name: 'sampleName',
      startDate: '12/01/01',
      cost: 1000,
      note: 'sampleNot',
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

});
