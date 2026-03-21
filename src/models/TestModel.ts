export interface ITestModel {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  age: number;
  active: boolean;
}

export class TestModel implements ITestModel {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  age: number;
  active: boolean;

  constructor(data: Partial<ITestModel>) {
    this.id = data.id || '';
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.name = data.name ?? '';
    this.age = data.age ?? 0;
    this.active = data.active ?? false;
  }
}
