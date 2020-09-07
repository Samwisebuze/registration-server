import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, getConnection, Not } from 'typeorm';
import { validateOrReject } from 'class-validator';
import { Match } from '../match.entity';
import { ScoreService } from './score.service';
import { ProfileDTO, ScoredProfileDTO } from './profile.dto';
import { User } from '../user.entity';

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(Match) private matches: Repository<Match>,
    private scoreService: ScoreService
  ) {}

  private async getMatches(from: User): Promise<Array<Match>> {
    return this.matches.find({ from: from.id });
  }

  private async getUnscoredProfiles(from: User): Promise<Array<User>> {
    const matches = await this.getMatches(from);
    const matchedUsers = matches.map(match => match.to);

    const coll = getConnection().getMongoRepository(User);
    return coll.find({
      where: {
        visible: true,
        _id: { $not: { $in: [ ...matchedUsers, from.id ] } },
      }
    });
  }

  async getScoredProfiles(fromId: string): Promise<Array<ScoredProfileDTO>> {
    const from = await this.users.findOne(fromId);
    if(!from.visible) {
      throw new HttpException(`Profile must be visible`, HttpStatus.UNAUTHORIZED);
    }

    const unscoredProfiles = await this.getUnscoredProfiles(from);
    const scoredProfiles = this.scoreService.scoreAndSortProfiles(from, unscoredProfiles);
    return scoredProfiles;
  }

  async getProfile(id: string): Promise<User> {
    const user = this.users.findOne(id, { select: [
      `email`,
      `name`,
      `skills`,
      `idea`,
      `lookingFor`,
      `slack`,
      `started`,
      `completed`,
      `visible`
    ]});

    if(!user) {
      Logger.error(`User ${id} not found`);
      throw new HttpException(`User not found`, HttpStatus.NOT_FOUND);
    }

    return user;
  }

  async startProfile(id: string): Promise<void> {
    const profile = await this.users.findOne(id);
    if(profile.started) {
      throw new HttpException(`Profile already started`, HttpStatus.BAD_REQUEST);
    }

    profile.started = true;
    await this.users.save(profile);
  }

  async updateProfile(id: string, updates: ProfileDTO): Promise<User> {
    const profile = await this.users.findOne(id);
    if(!profile) {
      Logger.error(`User ${id} not found`);
      throw new HttpException(`User not found`, HttpStatus.NOT_FOUND);
    }

    const newProfile: User = Object.assign(profile, updates);

    try {
      validateOrReject(newProfile);
    } catch(err) {
      Logger.error(`Validation error`);
      Logger.error(err);
      throw new HttpException(`Invalid profile fields`, HttpStatus.BAD_REQUEST);
    }

    if(!newProfile.completed) {
      newProfile.completed = true;
    }
    
    try {
      await this.users.save(newProfile);
    } catch (err) {
      Logger.error(err);
      throw new HttpException(`Error updating user profile: ${err.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return this.getProfile(id);
  }

  async setVisible(id: string, visible: boolean): Promise<User> {
    const profile = await this.users.findOne(id);
    profile.visible = !!visible;
    return this.users.save(profile);
  }
}
