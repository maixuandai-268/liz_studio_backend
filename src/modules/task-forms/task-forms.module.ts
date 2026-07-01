import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskForm } from './entities/task-forms.entity';
import { TaskFormField } from './entities/task-form-field.entity';
import { TaskFormSubmission } from './entities/task-form-submission.entity';
import { TaskFormSubmissionValue } from './entities/task-form-submission-value.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TaskForm,
      TaskFormField,
      TaskFormSubmission,
      TaskFormSubmissionValue,
    ]),
  ],
})
export class TaskFormsModule {}

