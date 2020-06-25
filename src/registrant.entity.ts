import { Entity, Column, ObjectID, ObjectIdColumn } from 'typeorm';

@Entity()
export class Registrant {
  @ObjectIdColumn()
  id: ObjectID;

  @Column()
  fullName: string;

  @Column({ unique: true })
  email: string;

  @Column()
  degree: string;

  @Column()
  hackathonsAttended: number;

  @Column()
  resumeUrl: string;

  @Column()
  ethnicity: string;

  @Column()
  gender: string;
}