import { Struct } from 'google-protobuf/google/protobuf/struct_pb';
import * as chai from 'chai';
import { default as sinon } from 'ts-sinon';
import * as sinonChai from 'sinon-chai';
import 'mocha';

import { Step as ProtoStep, StepDefinition, RunStepResponse } from '../../src/proto/cog_pb';
import { Step } from '../../src/steps/custom-object-create-or-update';

chai.use(sinonChai);

describe('CreateOrUpdateCustomObject', () => {
  const expect = chai.expect;
  let protoStep: ProtoStep;
  let stepUnderTest: Step;
  let clientWrapperStub: any;

  beforeEach(() => {
    protoStep = new ProtoStep();
    clientWrapperStub = sinon.stub();
    clientWrapperStub.getCustomObject = sinon.stub();
    clientWrapperStub.describeLeadFields = sinon.stub();
    clientWrapperStub.findLeadByEmail = sinon.stub();
    clientWrapperStub.createOrUpdateCustomObject = sinon.stub();
    stepUnderTest = new Step(clientWrapperStub);
  });

  it('should return expected step metadata', () => {
    const stepDef: StepDefinition = stepUnderTest.getDefinition();
    expect(stepDef.getStepId()).to.equal('CreateOrUpdateCustomObjectStep');
    expect(stepDef.getName()).to.equal('Create or Update a Marketo Custom Object');
    expect(stepDef.getExpression()).to.equal('create or update an? (?<name>.+) marketo custom object linked to lead (?<linkValue>.+)');
    expect(stepDef.getType()).to.equal(StepDefinition.Type.ACTION);
  });

  it('should respond with success if the marketo executes succesfully', async () => {
    const nameValue: string = 'anyCustomObjectName';
    const linkValueValue: string = 'anyLinkValue';
    const objectValue = {
      anyField: 'anyValue',
    };
    clientWrapperStub.getCustomObject.returns(Promise.resolve({
      success: true,
      result: [
        {
          idField: 'anyIdField',
          dedupeFields: ['anyDedupeField'],
          relationships: [
            {
              field: 'anyRelationshipField',
              relatedTo: {
                name: 'Lead',
                field: 'anyLeadField',
              },
            },
          ],
          fields: [
            {
              name:'anyFieldName',
              displayName:'anyDisplayName',
            },
          ],
        },
      ],
    }));
    clientWrapperStub.describeLeadFields.returns(Promise.resolve({
      result: [
        {
          displayName: 'anyLeadField',
          rest: {
            name: 'anyLeadRestField',
          },
        },
      ],
    }));
    clientWrapperStub.findLeadByEmail.returns(Promise.resolve({
      result: [
        {
          anyLeadRestField: 'anyFieldValue',
        },
      ],
    }));
    clientWrapperStub.createOrUpdateCustomObject.returns(Promise.resolve({
      success: true,
      result:[
        {},
      ],
    }));
    protoStep.setData(Struct.fromJavaScript({
      name: nameValue,
      linkValue: linkValueValue,
      object: objectValue,
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });

  it('should respond with fail if the marketo execution fails', async () => {
    const nameValue: string = 'anyCustomObjectName';
    const linkValueValue: string = 'anyLinkValue';
    const objectValue = {
      anyField: 'anyValue',
    };
    clientWrapperStub.getCustomObject.returns(Promise.resolve({
      success: true,
      result: [
        {
          idField: 'anyIdField',
          dedupeFields: ['anyDedupeField'],
          relationships: [
            {
              field: 'anyRelationshipField',
              relatedTo: {
                name: 'Lead',
                field: 'anyLeadField',
              },
            },
          ],
          fields: [
            {
              name:'anyFieldName',
              displayName:'anyDisplayName',
            },
          ],
        },
      ],
    }));
    clientWrapperStub.describeLeadFields.returns(Promise.resolve({
      result: [
        {
          displayName: 'anyLeadField',
          rest: {
            name: 'anyLeadRestField',
          },
        },
      ],
    }));
    clientWrapperStub.findLeadByEmail.returns(Promise.resolve({
      result: [
        {
          anyLeadRestField: 'anyFieldValue',
        },
      ],
    }));
    clientWrapperStub.createOrUpdateCustomObject.returns(Promise.resolve({
      success: false,
      result: [
        {
          reasons: [
            {
              message: 'someReason',
            },
          ],
        },
      ],
    }));
    protoStep.setData(Struct.fromJavaScript({
      name: nameValue,
      linkValue: linkValueValue,
      object: objectValue,
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.FAILED);
  });

  it('should respond with error if custom object does not exist', async () => {
    const nameValue: string = 'anyCustomObjectName';
    const linkValueValue: string = 'anyLinkValue';
    const objectValue = {
      anyField: 'anyValue',
    };
    clientWrapperStub.getCustomObject.returns(Promise.resolve({
      success: true,
      result: [],
    }));
    protoStep.setData(Struct.fromJavaScript({
      name: nameValue,
      linkValue: linkValueValue,
      object: objectValue,
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

  it('should respond with error if custom object is not linked to Leads', async () => {
    const nameValue: string = 'anyCustomObjectName';
    const linkValueValue: string = 'anyLinkValue';
    const objectValue = {
      anyField: 'anyValue',
    };
    clientWrapperStub.getCustomObject.returns(Promise.resolve({
      success: true,
      result: [{
        idField: 'anyIdField',
        dedupeFields: ['anyDedupeField'],
        relationships: [],
        fields: [
          {
            name:'anyFieldName',
            displayName:'anyDisplayName',
          },
        ],
      },
      ],
    }));
    protoStep.setData(Struct.fromJavaScript({
      name: nameValue,
      linkValue: linkValueValue,
      object: objectValue,
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

  it('should respond with error if lead does not exist', async () => {
    const nameValue: string = 'anyCustomObjectName';
    const linkValueValue: string = 'anyLinkValue';
    const objectValue = {
      anyField: 'anyValue',
    };
    clientWrapperStub.getCustomObject.returns(Promise.resolve({
      success: true,
      result: [
        {
          idField: 'anyIdField',
          dedupeFields: ['anyDedupeField'],
          relationships: [
            {
              field: 'anyRelationshipField',
              relatedTo: {
                name: 'Lead',
                field: 'anyLeadField',
              },
            },
          ],
          fields: [
            {
              name:'anyFieldName',
              displayName:'anyDisplayName',
            },
          ],
        },
      ],
    }));
    clientWrapperStub.describeLeadFields.returns(Promise.resolve({
      result: [
        {
          displayName: 'anyLeadField',
          rest: {
            name: 'anyLeadRestField',
          },
        },
      ],
    }));
    clientWrapperStub.findLeadByEmail.returns(Promise.resolve({
      result: [],
    }));
    clientWrapperStub.createOrUpdateCustomObject.returns(Promise.resolve({
      success: true,
      result:[
        {},
      ],
    }));
    protoStep.setData(Struct.fromJavaScript({
      name: nameValue,
      linkValue: linkValueValue,
      object: objectValue,
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

  it('should respond with an error if the marketo throws an error', async () => {
    clientWrapperStub.getCustomObject.throws('any error');
    protoStep.setData(Struct.fromJavaScript({
      name: 'anyName',
      linkValue: 'anyLinkValue',
      object: { anyField: 'anyValue' },
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

});
