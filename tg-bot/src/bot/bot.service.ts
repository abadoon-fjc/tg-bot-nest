// src/bot/bot.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramBot, Message, CallbackQuery } from 'node-telegram-bot-api';
import axios from 'axios';

@Injectable()
export class BotService {
  private readonly bot: TelegramBot;
  private readonly logger = new Logger(BotService.name);
  private userData = {};

  constructor(private readonly configService: ConfigService) {
    const token = this.configService.get<string>('8122390094:AAGsmJoDOmQL320Ne16_q0KLy8zuGjXwAmc');
    this.bot = new TelegramBot(token, { polling: true });
    this.initializeBot();
  }

  private initializeBot() {
    this.bot.onText(/\/start/, (msg: Message) => this.handleStartCommand(msg));
    this.bot.on('message', (msg: Message) => this.handleMessage(msg));
    this.bot.on('callback_query', (query: CallbackQuery) => this.handleCallbackQuery(query));
  }

  private capitalizeName(name: string): string {
    if (!name) return '';
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  }

  private async handleStartCommand(msg: Message) {
    const chatId = msg.chat.id;

    if (this.userData[chatId] && this.userData[chatId].isNamed) {
      this.bot.sendMessage(chatId, `Оооооо, ${this.userData[chatId].userName}, вы вернулись! Курс какой валюты хотите узнать?`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Доллар', callback_data: 'USD' }],
            [{ text: 'Евро', callback_data: 'EUR' }],
          ],
        },
      });
    } else {
      this.bot.sendMessage(chatId, 'Добрый день. Как вас зовут?');
      this.userData[chatId] = { userName: '', isNamed: false };
    }
  }

  private async handleMessage(msg: Message) {
    const chatId = msg.chat.id;
    const text = msg.text.trim();

    if (text.startsWith('/')) {
      return;
    }

    if (this.userData[chatId] && !this.userData[chatId].isNamed) {
      const userName = this.capitalizeName(text);
      this.userData[chatId].userName = userName;
      this.userData[chatId].isNamed = true;

      this.bot.sendMessage(chatId, `Рад знакомству, ${userName}! Курс какой валюты хотите узнать?`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Доллар', callback_data: 'USD' }],
            [{ text: 'Евро', callback_data: 'EUR' }],
          ],
        },
      });
    } else if (this.userData[chatId] && this.userData[chatId].isNamed) {
      const lowerText = text.toLowerCase();

      if (lowerText.includes('доллар') || lowerText === 'usd') {
        this.sendCurrencyRate(chatId, 'USD');
      } else if (lowerText.includes('евро') || lowerText === 'eur') {
        this.sendCurrencyRate(chatId, 'EUR');
      } else {
        this.bot.sendMessage(chatId, `Айайай, ${this.userData[chatId].userName}, я вас не понял. Курс какой валюты хотите узнать?`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Доллар', callback_data: 'USD' }],
              [{ text: 'Евро', callback_data: 'EUR' }],
            ],
          },
        });
      }
    }
  }

  private async handleCallbackQuery(query: CallbackQuery) {
    const chatId = query.message.chat.id;
    const currency = query.data;
    this.sendCurrencyRate(chatId, currency);
  }

  private async sendCurrencyRate(chatId: number, currency: string) {
    try {
      const response = await axios.get('https://www.cbr-xml-daily.ru/daily_json.js');
      const usdRate = response.data.Valute.USD.Value;
      const eurRate = response.data.Valute.EUR.Value;

      let rate;
      if (currency === 'USD') {
        rate = usdRate;
      } else if (currency === 'EUR') {
        rate = eurRate;
      }

      this.bot.sendMessage(chatId, `Курс ${currency === 'USD' ? 'доллара' : 'евро'} сегодня ${rate}₽`);
    } catch (error) {
      this.logger.error('Ошибка получения курса валюты:', error);
      this.bot.sendMessage(chatId, 'Не удалось получить курс валюты. Попробуйте позже.');
    }
  }
}
