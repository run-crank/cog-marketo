import { Struct } from 'google-protobuf/google/protobuf/struct_pb';
import * as chai from 'chai';
import { default as sinon } from 'ts-sinon';
import * as sinonChai from 'sinon-chai';
import 'mocha';

import { Step as ProtoStep, StepDefinition, RunStepResponse } from '../../src/proto/cog_pb';
import { Step } from '../../src/steps/custom-object-field-equals';

chai.use(sinonChai);

describe('CustomObjectFieldEquals', () => {
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
    clientWrapperStub.queryCustomObject  = sinon.stub();
    stepUnderTest = new Step(clientWrapperStub);
  });

  it('should return expected step metadata', () => {
    const stepDef: StepDefinition = stepUnderTest.getDefinition();
    expect(stepDef.getStepId()).to.equal('CustomObjectFieldEqualsStep');
    expect(stepDef.getName()).to.equal('Check a field on a Marketo Custom Object');
    expect(stepDef.getExpression()).to.equal('the (?<field>[a-zA-Z0-9_-]+) field on the (?<name>.+) marketo custom object linked to lead (?<linkValue>.+) should (?<operator>be less than|be greater than|be|contain|not be|not contain) (?<expectedValue>.+)');
    expect(stepDef.getType()).to.equal(StepDefinition.Type.VALIDATION);
  });

  it('should respond with success if the marketo executes succesfully', async () => {
    const nameValue: string = 'anyCustomObjectName';
    const linkValueValue: string = 'anyLinkValue';
    const dedupeFieldValues = {
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
          anyLeadRestField: 'anyIdFieldValue',
        },
      ],
    }));
    clientWrapperStub.queryCustomObject.returns(Promise.resolve({
      success: true,
      result: [
        {
          anyRelationshipField: 'anyIdFieldValue',
        },
      ],
    }));
    protoStep.setData(Struct.fromJavaScript({
      name: nameValue,
      linkValue: linkValueValue,
      field: 'anyRelationshipField',
      operator: 'be',
      expectedValue: 'anyIdFieldValue',
      dedupeField: dedupeFieldValues,
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });

  it('should respond with fail if the marketo execution fails', async () => {
    const nameValue: string = 'anyCustomObjectName';
    const linkValueValue: string = 'anyLinkValue';
    const dedupeFieldValues = {
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
          anyLeadRestField: 'anyOtherIdFieldValue',
        },
      ],
    }));
    clientWrapperStub.queryCustomObject.returns(Promise.resolve({
      success:true,
      result: [
        {
          anyRelationshipField: 'anyOtherIdFieldValue',
        },
      ],
    }));
    protoStep.setData(Struct.fromJavaScript({
      name: nameValue,
      linkValue: linkValueValue,
      field: 'anyRelationshipField',
      operator: 'be',
      expectedValue: 'anyIdFieldValue',
      dedupeField: dedupeFieldValues,
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.FAILED);
  });

  it('should respond with error if custom object does not exist', async () => {
    const nameValue: string = 'anyCustomObjectName';
    const linkValueValue: string = 'anyLinkValue';
    const dedupeFieldValues = {
      anyField: 'anyValue',
    };
    clientWrapperStub.getCustomObject.returns(Promise.resolve({
      success: true,
      result: [],
    }));
    protoStep.setData(Struct.fromJavaScript({
      name: nameValue,
      linkValue: linkValueValue,
      field: 'anyIdField',
      operator: 'be',
      expectedValue: 'anyIdFieldValue',
      dedupeField: dedupeFieldValues,
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

  it('should respond with error if custom object is not linked to Leads', async () => {
    const nameValue: string = 'anyCustomObjectName';
    const linkValueValue: string = 'anyLinkValue';
    const dedupeFieldValues = {
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
      field: 'anyIdField',
      operator: 'be',
      expectedValue: 'anyIdFieldValue',
      dedupeField: dedupeFieldValues,
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

  it('should respond with error if lead does not exist', async () => {
    const nameValue: string = 'anyCustomObjectName';
    const linkValueValue: string = 'anyLinkValue';
    const dedupeFieldValues = {
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
    protoStep.setData(Struct.fromJavaScript({
      name: nameValue,
      linkValue: linkValueValue,
      field: 'anyIdField',
      operator: 'be',
      expectedValue: 'anyIdFieldValue',
      dedupeField: dedupeFieldValues,
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

  it('should respond with error if query does not exist', async () => {
    const nameValue: string = 'anyCustomObjectName';
    const linkValueValue: string = 'anyLinkValue';
    const dedupeFieldValues = {
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
    clientWrapperStub.queryCustomObject.returns(Promise.resolve({
      result: [
        {
          anyIdField: 'anyIdFieldValue',
        },
        {
          anyIdField: 'anyIdFieldValue',
        },
      ],
    }));
    protoStep.setData(Struct.fromJavaScript({
      name: nameValue,
      linkValue: linkValueValue,
      field: 'anyIdField',
      operator: 'be',
      expectedValue: 'anyIdFieldValue',
      dedupeField: dedupeFieldValues,
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

  it('should respond with an error if the marketo throws an error', async () => {
    const nameValue: string = 'anyCustomObjectName';
    const linkValueValue: string = 'anyLinkValue';
    const dedupeFieldValues = {
      anyField: 'anyValue',
    };
    clientWrapperStub.getCustomObject.throws('any error');
    protoStep.setData(Struct.fromJavaScript({
      name: nameValue,
      linkValue: linkValueValue,
      field: 'anyIdField',
      operator: 'be',
      expectedValue: 'anyIdFieldValue',
      dedupeField: dedupeFieldValues,
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

});
