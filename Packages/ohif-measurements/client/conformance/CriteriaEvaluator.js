import { BaseCriterion } from './criteria/BaseCriterion';
import * as Criteria from './criteria';
import { _ } from 'meteor/underscore';
import Ajv from 'ajv';

export class CriteriaEvaluator {

    constructor(criteriaObject) {
        const criteriaValidator = this.getCriteriaValidator();
        this.criteria = [];

        if (!criteriaValidator(criteriaObject)) {
            let message = '';
            _.each(criteriaValidator.errors, error => {
                message += `\noptions${error.dataPath} ${error.message}`;
            });
            throw new Error(message);
        }

        _.each(criteriaObject, (optionsObject, criterionkey) => {
            const Criterion = Criteria[`${criterionkey}Criterion`];
            const optionsArray = optionsObject instanceof Array ? optionsObject : [optionsObject];
            _.each(optionsArray, options => this.criteria.push(new Criterion(options)));
        });
    }

    getCriteriaValidator() {
        if(CriteriaEvaluator.criteriaValidator) {
            return CriteriaEvaluator.criteriaValidator;
        }

        const schema = {
            properties: {},
            definitions: {}
        };

        _.each(Criteria, (Criterion, key) => {
            if (Criterion.prototype instanceof BaseCriterion) {
                const criterionkey = key.replace(/Criterion$/, '');
                const criterionDefinition = `#/definitions/${criterionkey}`;

                schema.definitions[criterionkey] = Criteria[`${criterionkey}Schema`];
                schema.properties[criterionkey] = {
                    oneOf: [
                        { $ref: criterionDefinition },
                        {
                            type: 'array',
                            items: {
                                $ref: criterionDefinition
                            }
                        }
                    ]
                };
            }
        });
        
        return CriteriaEvaluator.criteriaValidator = new Ajv().compile(schema);
    }

    evaluate(data) {
        const nonconformities = [];
        this.criteria.forEach(criterion => {
            const criterionResult = criterion.evaluate(data);
            if (!criterionResult.passed) {
                nonconformities.push(criterionResult);
            }
        });
        return nonconformities;
    }

}
