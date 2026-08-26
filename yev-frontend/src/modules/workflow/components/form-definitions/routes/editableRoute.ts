import {
    ApproverMode,
    OrgUnitScope,
    ParticipantRole,
    ParticipantSource,
    StepType,
    type FormApprovalStepDto,
    type FormApprovalStepParticipantDto,
    type FormRouteDto,
    type ReplaceFormApprovalStepItemDto,
    type ReplaceFormApprovalStepParticipantItemDto,
    type ReplaceFormRouteItemDto,
} from "@/modules/workflow/types/form-route.dto";
import { randomClientId } from "@/lib/uuid";

export interface EditableParticipant extends ReplaceFormApprovalStepParticipantItemDto {
    clientId: string;
}

export interface EditableStep extends Omit<ReplaceFormApprovalStepItemDto, "participants"> {
    clientId: string;
    participants: EditableParticipant[];
}

export interface EditableRoute extends Omit<ReplaceFormRouteItemDto, "steps"> {
    clientId: string;
    steps: EditableStep[];
}

function newClientId(): string {
    return `new-${randomClientId()}`;
}

export function fromParticipantDto(dto: FormApprovalStepParticipantDto): EditableParticipant {
    return {
        clientId: newClientId(),
        participantSource: dto.participantSource,
        employeeId: dto.employeeId,
        jobTitleId: dto.jobTitleId,
        participantRole: dto.participantRole,
    };
}

export function fromStepDto(dto: FormApprovalStepDto): EditableStep {
    return {
        clientId: newClientId(),
        nameVn: dto.nameVn,
        nameJp: dto.nameJp,
        stepType: dto.stepType,
        orgUnitScope: dto.orgUnitScope,
        orgUnitId: dto.orgUnitId,
        approverMode: dto.approverMode,
        requireSignature: dto.requireSignature,
        allowSendBack: dto.allowSendBack,
        allowAddApprover: dto.allowAddApprover,
        participants: dto.participants.map(fromParticipantDto),
    };
}

export function fromRouteDto(dto: FormRouteDto): EditableRoute {
    return {
        clientId: newClientId(),
        id: dto.id,
        nameVn: dto.nameVn,
        nameJp: dto.nameJp,
        minValue: dto.minValue,
        maxValue: dto.maxValue,
        classValue: dto.classValue,
        isDefault: dto.isDefault,
        steps: dto.steps.map(fromStepDto),
    };
}

export function createDefaultParticipant(): EditableParticipant {
    return {
        clientId: newClientId(),
        participantSource: ParticipantSource.Employee,
        employeeId: null,
        jobTitleId: null,
        participantRole: ParticipantRole.Approver,
    };
}

export function createDefaultStep(defaultLabel: string): EditableStep {
    return {
        clientId: newClientId(),
        nameVn: defaultLabel,
        nameJp: null,
        stepType: StepType.Approve,
        orgUnitScope: OrgUnitScope.ApplicantUnit,
        orgUnitId: null,
        approverMode: ApproverMode.Any,
        requireSignature: false,
        allowSendBack: true,
        allowAddApprover: false,
        participants: [],
    };
}

export function createDefaultRoute(defaultLabel: string): EditableRoute {
    return {
        clientId: newClientId(),
        id: null,
        nameVn: defaultLabel,
        nameJp: null,
        minValue: null,
        maxValue: null,
        classValue: null,
        isDefault: false,
        steps: [],
    };
}

export function toReplaceRouteItem(route: EditableRoute): ReplaceFormRouteItemDto {
    return {
        id: route.id,
        nameVn: route.nameVn,
        nameJp: route.nameJp,
        minValue: route.minValue,
        maxValue: route.maxValue,
        classValue: route.classValue,
        isDefault: route.isDefault,
        steps: route.steps.map((step) => ({
            nameVn: step.nameVn,
            nameJp: step.nameJp,
            stepType: step.stepType,
            orgUnitScope: step.orgUnitScope,
            orgUnitId: step.orgUnitId,
            approverMode: step.approverMode,
            requireSignature: step.requireSignature,
            allowSendBack: step.allowSendBack,
            allowAddApprover: step.allowAddApprover,
            participants: step.participants.map((p) => ({
                participantSource: p.participantSource,
                employeeId: p.employeeId,
                jobTitleId: p.jobTitleId,
                participantRole: p.participantRole,
            })),
        })),
    };
}
