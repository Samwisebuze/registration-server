import { readFile } from 'fs';
import { Injectable, Logger } from '@nestjs/common';
import * as sgMail from '@sendgrid/mail';
import Handlebars from 'handlebars';
import { Registrant } from './registrant.entity';

const sendgridApiKey = process.env.SENDGRID_API_KEY;
const serverHost = process.env.HOST;
const websiteHost = process.env.WEBSITE_URL;

sgMail.setApiKey(sendgridApiKey);

@Injectable()
export class EmailService {
  fromAddress = `info@makeuc.io`;

  template: HandlebarsTemplateDelegate<{ fullName: string, verificationUrl: string, coverImgUrl: string }>;

  constructor() {
    this.getEmailTemplate();
  }

  getEmailTemplate(): void {
    readFile(`${__dirname}/../../templates/index.html`, (err, data) => {
      if(err) Logger.error(err);
      if(!data) Logger.error(new Error(`Verification email template not found`));

      this.template = Handlebars.compile(data.toString())
    });
  }

  async sendVerificationEmail(registrant: Registrant): Promise<void> {
    const fullName = registrant.fullName;
    const verificationUrl = `${serverHost}/registrant/verify/${registrant.id}`;
    const coverImgUrl = `${websiteHost}/email/cover.png`;

    if(!this.template) {
      return Logger.error(`Verification email template not found`);
    }

    const msg: sgMail.MailDataRequired = {
      to: registrant.email,
      from: this.fromAddress,
      subject: 'MakeUC registration',
      text: 'Confirm your email with MakeUC',
      html: this.template({ fullName, verificationUrl, coverImgUrl })
    };

    sgMail.send(msg).then(() => {
      Logger.log(`Verification email sent to ${registrant.email} successfully`);
    }).catch(err => {
      Logger.error(`Verification email could not be sent to ${registrant.email}: ${err.message}`);
    });
  }

  async sendEmail(msg: sgMail.MailDataRequired): Promise<void> {
    await sgMail.send(msg);
  }
}
