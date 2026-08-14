import React from 'react';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';

interface CommercialDisclosureViewProps {
  onBack: () => void;
}

const PENDING_DISCLOSURE = 'ご請求をいただいた場合、遅滞なく開示いたします。';

type Entry = {
  label: string;
  value: React.ReactNode;
};

const entries: Entry[] = [
  {
    label: 'サービス名',
    value: '匿名セトリ推理ゲーム（誰の曲？）',
  },
  {
    label: '事業者名 / 氏名',
    value: PENDING_DISCLOSURE,
  },
  {
    label: '所在地',
    value: PENDING_DISCLOSURE,
  },
  {
    label: '電話番号',
    value: PENDING_DISCLOSURE,
  },
  {
    label: '運営責任者',
    value: PENDING_DISCLOSURE,
  },
  {
    label: 'お問い合わせ先メールアドレス',
    value: (
      <a href="mailto:studiotomo99@gmail.com" className="text-primary-600 underline hover:text-primary-700">
        studiotomo99@gmail.com
      </a>
    ),
  },
  {
    label: '提供内容',
    value: (
      <>
        無料Webアプリ「匿名セトリ推理ゲーム」の開発・運営を行っています。希望する利用者等から
        Buy Me a Coffee を通じて、開発・運営活動に対する任意の支援を受け付けています。支援に対する
        商品の販売や必須の対価・特典はなく、Webアプリ自体は無料で利用できます。
      </>
    ),
  },
  {
    label: '支援金額（価格）',
    value: 'Buy Me a Coffee の支援ページに表示される金額となります。',
  },
  {
    label: '商品代金以外に必要な料金',
    value: (
      <>
        物品の送料等はありません。本Webサイトのご利用にあたって発生するインターネット接続料金・通信料金は、
        利用者様のご負担となります。Buy Me a Coffee の決済手数料等が別途発生する場合は、
        Buy Me a Coffee の支援ページの表示に従います。
      </>
    ),
  },
  {
    label: 'お支払い方法',
    value: 'Buy Me a Coffee を通じたオンライン決済（クレジットカード等、Buy Me a Coffee の決済ページに表示される方法）に対応しています。',
  },
  {
    label: 'お支払い時期',
    value: 'Buy Me a Coffee 上で支援手続きが完了した時点で決済されます。',
  },
  {
    label: 'サービス提供時期',
    value: '匿名セトリ推理ゲーム自体は無料で公開しており、Webサイトからいつでもご利用いただけます。支援に対する商品・有料サービスの提供はありません。',
  },
  {
    label: 'キャンセル・返金について',
    value: (
      <>
        任意の支援という性質上、支援完了後のキャンセル・返金は原則として受け付けておりません。ただし、
        重複決済や不正利用など個別の対応が必要な場合は、お問い合わせ先までご連絡ください。返金の取り扱いは
        Buy Me a Coffee の規約・ポリシーに従います。
      </>
    ),
  },
];

export const CommercialDisclosureView: React.FC<CommercialDisclosureViewProps> = ({ onBack }) => {
  return (
    <Layout title="特定商取引法に基づく表記" showBack onBack={onBack}>
      <div className="space-y-4">
        <p className="text-sm leading-6 text-slate-600">
          「匿名セトリ推理ゲーム」は無料でご利用いただけるWebアプリです。希望する利用者様から、
          Buy Me a Coffee を通じて開発・運営活動への任意のご支援を受け付けています。特定商取引法に
          基づき、以下のとおり表記いたします。
        </p>

        <Card className="border-2 border-slate-600/40 bg-white shadow-none hover:border-slate-600/40 hover:bg-white">
          <dl className="divide-y divide-slate-200">
            {entries.map((entry) => (
              <div key={entry.label} className="py-3 first:pt-0 last:pb-0">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {entry.label}
                </dt>
                <dd className="mt-1.5 text-sm leading-6 text-slate-700 break-words">{entry.value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </Layout>
  );
};
